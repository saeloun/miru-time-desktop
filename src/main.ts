import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";
import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  type MenuItem,
  type MenuItemConstructorOptions,
  type MessageBoxOptions,
  nativeImage,
  powerMonitor,
  screen,
  Tray,
} from "electron";
import { ipcMain } from "electron/main";
import {
  installExtension,
  REACT_DEVELOPER_TOOLS,
} from "electron-devtools-installer";
import { UpdateSourceType, updateElectronApp } from "update-electron-app";
import { ipcContext } from "@/ipc/context";
import {
  canOverrideMiruBaseUrl,
  DEFAULT_MIRU_BASE_URL,
  IPC_CHANNELS,
  inDevelopment,
  normalizeMiruBaseUrlValue,
} from "./constants";
import { getBasePath } from "./utils/path";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let trayTimer: NodeJS.Timeout | null = null;
let idleMonitor: NodeJS.Timeout | null = null;
let saveTimer: NodeJS.Timeout | null = null;
let idleSession: { prompted: boolean; startedAt: number } | null = null;
let latestTrayImageState = { empty: true, height: 0, width: 0 };

type Rgba = [number, number, number, number];

const timerState = {
  elapsedMs: 0,
  running: false,
  startedAt: 0,
};

const timerContext = {
  billable: false,
  notes: "",
  projectName: "No project selected",
  taskName: "Development",
};

const timerSummary = {
  entryCount: 0,
  selectedDateLabel: "Today",
  selectedDateMinutes: 0,
  syncStatus: "local",
  todayMinutes: 0,
  userLabel: "",
  weekMinutes: 0,
  workspaceName: "",
};

const timerSettings = {
  idleThresholdSeconds: 300,
};

const IDLE_THRESHOLDS = [
  { label: "After 1 minute", seconds: 60 },
  { label: "After 5 minutes", seconds: 300 },
  { label: "After 10 minutes", seconds: 600 },
  { label: "After 15 minutes", seconds: 900 },
  { label: "After 30 minutes", seconds: 1800 },
] as const;

const miruAccount = {
  authEmail: "",
  authToken: "",
  baseUrl: DEFAULT_MIRU_BASE_URL,
  company: null as Record<string, unknown> | null,
  companyRole: "",
  currentWorkspaceId: null as number | string | null,
  lastSyncAt: "",
  syncStatus: "local" as "error" | "local" | "offline" | "synced" | "syncing",
  syncError: "",
  user: null as Record<string, unknown> | null,
  workspaces: [] as Array<{ id: number | string; name: string; logo?: string }>,
};

const API_TIMEOUT_MS = 8000;

const TIMER_CHANNELS = {
  forceIdleForTesting: "miru-timer:force-idle-for-testing",
  getState: "miru-timer:get-state",
  idleAction: "miru-timer:idle-action",
  pause: "miru-timer:pause",
  reset: "miru-timer:reset",
  setContext: "miru-timer:set-context",
  setIdleThreshold: "miru-timer:set-idle-threshold",
  setSummary: "miru-timer:set-summary",
  start: "miru-timer:start",
  state: "miru-timer:state",
  toggle: "miru-timer:toggle",
};

const MIRU_API_CHANNELS = {
  deleteTimerEntry: "miru-api:delete-timer-entry",
  getTimeTracking: "miru-api:get-time-tracking",
  getSession: "miru-api:get-session",
  googleLogin: "miru-api:google-login",
  login: "miru-api:login",
  logout: "miru-api:logout",
  saveTimerEntry: "miru-api:save-timer-entry",
  signup: "miru-api:signup",
  syncCurrentTimer: "miru-api:sync-current-timer",
  switchWorkspace: "miru-api:switch-workspace",
  updateTimerEntry: "miru-api:update-timer-entry",
};

const NATIVE_UI_CHANNELS = {
  closeWindow: "native-ui:close-window",
  confirmDeleteTimeEntry: "native-ui:confirm-delete-time-entry",
  minimizeWindow: "native-ui:minimize-window",
  quitApp: "native-ui:quit-app",
};

type IdleAction = "remove-continue" | "remove-start-new" | "ignore-continue";

interface StoredTimerState {
  context?: Partial<typeof timerContext>;
  elapsedMs?: number;
  idleThresholdSeconds?: number;
  running?: boolean;
  savedAt?: number;
}

interface StoredAccountState {
  authEmail?: string;
  authToken?: string;
  baseUrl?: string;
  company?: Record<string, unknown> | null;
  companyRole?: string;
  currentWorkspaceId?: number | string | null;
  user?: Record<string, unknown> | null;
  workspaces?: Array<{ id: number | string; name: string; logo?: string }>;
}

if (process.env.MIRU_USER_DATA_DIR) {
  app.setPath("userData", process.env.MIRU_USER_DATA_DIR);
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }

  const basePath = getBasePath();
  const preload = path.join(basePath, "preload.js");
  mainWindow = new BrowserWindow({
    backgroundColor: "#00000000",
    frame: false,
    fullscreenable: false,
    hasShadow: true,
    height: 640,
    maximizable: false,
    minHeight: 560,
    minWidth: 380,
    resizable: false,
    show: false,
    transparent: true,
    title: "Miru Time Tracking",
    vibrancy: "popover",
    visualEffectState: "active",
    width: 392,
    webPreferences: {
      devTools: inDevelopment,
      contextIsolation: true,
      nodeIntegration: true,
      nodeIntegrationInSubFrames: false,

      preload,
    },
  });
  ipcContext.setMainWindow(mainWindow);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.once("ready-to-show", () => {
    if (!(mainWindow && !mainWindow.isDestroyed())) {
      return;
    }

    showMainWindow(mainWindow);
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(basePath, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  return mainWindow;
}

async function installExtensions() {
  try {
    const result = await installExtension(REACT_DEVELOPER_TOOLS);
    console.log(`Extensions installed successfully: ${result.name}`);
  } catch {
    console.error("Failed to install extensions");
  }
}

function checkForUpdates() {
  updateElectronApp({
    updateSource: {
      type: UpdateSourceType.ElectronPublicUpdateService,
      repo: "vipulnsward/miru-time-desktop",
    },
  });
}

async function setupORPC() {
  const { rpcHandler } = await import("./ipc/handler");

  ipcMain.on(IPC_CHANNELS.START_ORPC_SERVER, (event) => {
    const [serverPort] = event.ports;

    serverPort.start();
    rpcHandler.upgrade(serverPort);
  });
}

function setupTimerIPC() {
  ipcMain.handle(TIMER_CHANNELS.getState, () => getTimerSnapshot());
  ipcMain.handle(TIMER_CHANNELS.start, () => startTrayTimer());
  ipcMain.handle(TIMER_CHANNELS.pause, () => pauseTrayTimer());
  ipcMain.handle(TIMER_CHANNELS.reset, () => resetTrayTimer());
  ipcMain.handle(TIMER_CHANNELS.toggle, () => toggleTrayTimer());
  ipcMain.handle(TIMER_CHANNELS.setContext, (_event, context) => {
    updateTimerContext(sanitizeTimerContext(context));
    return getTimerSnapshot();
  });
  ipcMain.handle(TIMER_CHANNELS.setSummary, (_event, summary) => {
    updateTimerSummary(sanitizeTimerSummary(summary));
    return getTimerSnapshot();
  });
  ipcMain.handle(TIMER_CHANNELS.setIdleThreshold, (_event, seconds: number) => {
    setIdleThreshold(Number(seconds));
    return getTimerSnapshot();
  });
  ipcMain.handle(TIMER_CHANNELS.idleAction, (_event, action: IdleAction) =>
    applyIdleAction(action)
  );

  if (process.env.MIRU_E2E === "true") {
    ipcMain.handle(
      TIMER_CHANNELS.forceIdleForTesting,
      (_event, durationMs: number) => {
        forceIdleForTesting(durationMs);
        return getTimerSnapshot();
      }
    );
  }
}

function setupMiruApiIPC() {
  ipcMain.handle(MIRU_API_CHANNELS.deleteTimerEntry, (_event, entryId) =>
    deleteTimerEntryFromMiru(entryId)
  );
  ipcMain.handle(MIRU_API_CHANNELS.getSession, () => getMiruSessionSnapshot());
  ipcMain.handle(MIRU_API_CHANNELS.getTimeTracking, (_event, payload) =>
    getMiruTimeTracking(payload)
  );
  ipcMain.handle(MIRU_API_CHANNELS.googleLogin, (_event, baseUrl) =>
    openGoogleLogin(baseUrl)
  );
  ipcMain.handle(MIRU_API_CHANNELS.login, (_event, payload) =>
    loginToMiru(payload)
  );
  ipcMain.handle(MIRU_API_CHANNELS.signup, (_event, payload) =>
    signupToMiru(payload)
  );
  ipcMain.handle(MIRU_API_CHANNELS.logout, () => logoutFromMiru());
  ipcMain.handle(MIRU_API_CHANNELS.switchWorkspace, (_event, workspaceId) =>
    switchMiruWorkspace(workspaceId)
  );
  ipcMain.handle(MIRU_API_CHANNELS.updateTimerEntry, (_event, payload) =>
    updateTimerEntryInMiru(payload)
  );
  ipcMain.handle(MIRU_API_CHANNELS.syncCurrentTimer, (_event, action) =>
    syncCurrentTimer(action)
  );
  ipcMain.handle(MIRU_API_CHANNELS.saveTimerEntry, (_event, payload) =>
    saveTimerEntryToMiru(payload)
  );
}

function setupNativeUiIPC() {
  ipcMain.handle(NATIVE_UI_CHANNELS.closeWindow, () => {
    mainWindow?.close();
  });
  ipcMain.handle(NATIVE_UI_CHANNELS.confirmDeleteTimeEntry, async () => {
    const options: MessageBoxOptions = {
      buttons: ["Delete Entry", "Cancel"],
      cancelId: 1,
      defaultId: 1,
      message: "Delete this time entry?",
      noLink: true,
      type: "warning",
    };
    const result =
      mainWindow && !mainWindow.isDestroyed()
        ? await dialog.showMessageBox(mainWindow, options)
        : await dialog.showMessageBox(options);

    return result.response === 0;
  });
  ipcMain.handle(NATIVE_UI_CHANNELS.minimizeWindow, () => {
    mainWindow?.minimize();
  });
  ipcMain.handle(NATIVE_UI_CHANNELS.quitApp, () => {
    app.quit();
  });
}

function createTray() {
  if (tray) {
    return;
  }

  tray = new Tray(createTrayImage(getTimerSnapshot()));
  tray.setToolTip("Miru Time Tracking");
  tray.setIgnoreDoubleClickEvents(true);
  tray.on("click", handleTrayClick);
  tray.on("right-click", showTrayMenu);

  ensureTrayInterval();
  updateTray();
  exposeE2EDiagnostics();
  startIdleMonitor();
}

function exposeE2EDiagnostics() {
  if (process.env.MIRU_E2E !== "true") {
    return;
  }

  Object.assign(globalThis, {
    __miruE2E: {
      getTrayBounds: () => tray?.getBounds() ?? null,
      getTrayImageState: () => latestTrayImageState,
      getTrayMenuLabels: () =>
        buildTrayMenu(getTimerSnapshot()).items.flatMap(menuItemLabels),
      getTrayTitle: () => tray?.getTitle() ?? "",
    },
  });
}

function menuItemLabels(item: MenuItem): string[] {
  const labels = item.label ? [item.label] : [];

  if (!item.submenu) {
    return labels;
  }

  return [...labels, ...item.submenu.items.flatMap(menuItemLabels)];
}

function handleTrayClick() {
  if (!tray) {
    return;
  }

  const snapshot = getTimerSnapshot();
  const bounds = tray.getBounds();
  const cursor = screen.getCursorScreenPoint();
  const relativeX = cursor.x - bounds.x;
  const controlWidth = Math.min(28, Math.max(22, bounds.width * 0.32));
  const stopWidth = snapshot.elapsedMs > 0 ? 22 : 0;

  if (relativeX <= controlWidth) {
    toggleTrayTimer();
    return;
  }

  if (stopWidth > 0 && relativeX >= bounds.width - stopWidth) {
    if (snapshot.running) {
      pauseTrayTimer();
      return;
    }

    openMainWindow();
    return;
  }

  toggleMainWindow();
}

function toggleMainWindow() {
  const window = createWindow();

  if (window.isVisible() && window.isFocused()) {
    window.hide();
    return;
  }

  showMainWindow(window);
}

function openMainWindow() {
  const window = createWindow();
  showMainWindow(window);
}

function showMainWindow(window: BrowserWindow) {
  if (window.isMinimized()) {
    window.restore();
  }

  positionMainWindowNearTray(window);
  window.show();
  window.focus();
}

function positionMainWindowNearTray(window: BrowserWindow) {
  if (!tray) {
    window.center();
    return;
  }

  const trayBounds = tray.getBounds();
  const windowBounds = window.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: Math.round(trayBounds.x + trayBounds.width / 2),
    y: Math.round(trayBounds.y + trayBounds.height / 2),
  });
  const workArea = display.workArea;
  const centeredX = Math.round(
    trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2
  );
  const x = Math.min(
    Math.max(centeredX, workArea.x + 8),
    workArea.x + workArea.width - windowBounds.width - 8
  );
  const belowTrayY = Math.round(trayBounds.y + trayBounds.height + 6);
  const y = Math.min(
    Math.max(belowTrayY, workArea.y + 8),
    workArea.y + workArea.height - windowBounds.height - 8
  );

  window.setPosition(x, y, false);
}

function timerStorePath() {
  return path.join(app.getPath("userData"), "timer-state.json");
}

function accountStorePath() {
  return path.join(app.getPath("userData"), "miru-account.json");
}

function hasNodeErrorCode(error: unknown, code: string) {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

async function loadTimerState() {
  const filePath = timerStorePath();

  try {
    const stored = JSON.parse(
      await readFile(filePath, "utf8")
    ) as StoredTimerState;

    timerState.running = Boolean(stored.running);
    timerState.elapsedMs = Math.max(0, stored.elapsedMs ?? 0);
    timerState.startedAt = timerState.running ? Date.now() : 0;

    if (timerState.running && stored.savedAt) {
      timerState.elapsedMs += Math.max(0, Date.now() - stored.savedAt);
    }

    updateTimerContext(stored.context ?? {}, false);

    if (stored.idleThresholdSeconds) {
      timerSettings.idleThresholdSeconds = stored.idleThresholdSeconds;
    }
  } catch (error: unknown) {
    if (hasNodeErrorCode(error, "ENOENT")) {
      return;
    }

    console.error("Failed to load timer state", error);
  }
}

async function loadAccountState() {
  const filePath = accountStorePath();

  try {
    const stored = JSON.parse(
      await readFile(filePath, "utf8")
    ) as StoredAccountState;

    miruAccount.authEmail = stored.authEmail ?? "";
    miruAccount.authToken = stored.authToken ?? "";
    miruAccount.baseUrl = normalizeMiruBaseUrl(
      stored.baseUrl ?? miruAccount.baseUrl
    );
    miruAccount.company = stored.company ?? null;
    miruAccount.companyRole = stored.companyRole ?? "";
    miruAccount.currentWorkspaceId = stored.currentWorkspaceId ?? null;
    miruAccount.user = stored.user ?? null;
    miruAccount.workspaces = stored.workspaces ?? [];
    miruAccount.syncStatus = miruAccount.authToken ? "offline" : "local";
  } catch (error: unknown) {
    if (hasNodeErrorCode(error, "ENOENT")) {
      return;
    }

    console.error("Failed to load Miru account state", error);
  }
}

async function persistTimerState() {
  try {
    const filePath = timerStorePath();
    await writeJsonFileAtomically(filePath, {
      context: timerContext,
      elapsedMs: currentElapsedMs(),
      idleThresholdSeconds: timerSettings.idleThresholdSeconds,
      running: timerState.running,
      savedAt: Date.now(),
    });
  } catch (error) {
    console.error("Failed to persist timer state", error);
  }
}

async function persistAccountState() {
  try {
    const filePath = accountStorePath();
    await writeJsonFileAtomically(filePath, {
      authEmail: miruAccount.authEmail,
      authToken: miruAccount.authToken,
      baseUrl: miruAccount.baseUrl,
      company: miruAccount.company,
      companyRole: miruAccount.companyRole,
      currentWorkspaceId: miruAccount.currentWorkspaceId,
      user: miruAccount.user,
      workspaces: miruAccount.workspaces,
    });
  } catch (error) {
    console.error("Failed to persist Miru account state", error);
  }
}

async function writeJsonFileAtomically(filePath: string, data: unknown) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(temporaryPath, JSON.stringify(data, null, 2));
  await rename(temporaryPath, filePath);
}

function normalizeMiruBaseUrl(value: string) {
  if (!canOverrideMiruBaseUrl) {
    return DEFAULT_MIRU_BASE_URL;
  }

  const trimmed = normalizeMiruBaseUrlValue(value);
  return trimmed || DEFAULT_MIRU_BASE_URL;
}

function persistAccountStateInBackground() {
  persistAccountState().catch((error) => {
    console.error("Failed to persist Miru account state", error);
  });
}

function persistTimerStateInBackground() {
  persistTimerState().catch((error) => {
    console.error("Failed to persist timer state", error);
  });
}

function getRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function getNullableRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function getStringField(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "string" ? value : "";
}

function getIdField(source: Record<string, unknown> | null, key: string) {
  if (!source) {
    return null;
  }

  const value = source[key];
  return typeof value === "number" || typeof value === "string" ? value : null;
}

function getNumberField(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const numericValue = Number(value);
      if (Number.isFinite(numericValue)) {
        return numericValue;
      }
    }
  }

  return 0;
}

function getMiruSessionSnapshot() {
  return {
    baseUrl: miruAccount.baseUrl,
    company: miruAccount.company,
    companyRole: miruAccount.companyRole,
    currentWorkspaceId: miruAccount.currentWorkspaceId,
    lastSyncAt: miruAccount.lastSyncAt,
    signedIn: Boolean(miruAccount.authToken && miruAccount.authEmail),
    syncError: miruAccount.syncError,
    syncStatus: miruAccount.syncStatus,
    user: miruAccount.user,
    workspaces: miruAccount.workspaces,
  };
}

function setMiruAccountFromAuth(
  data: Record<string, unknown>,
  baseUrl: string
) {
  const user = {
    ...getRecord(data.user),
    avatar_url:
      getStringField(getRecord(data.user), "avatar_url") ||
      getStringField(data, "avatar_url"),
  };
  const company = getNullableRecord(data.company);
  const token =
    getStringField(user, "token") ||
    getStringField(data, "auth_token") ||
    getStringField(data, "token");

  miruAccount.authEmail =
    getStringField(user, "email") || miruAccount.authEmail;
  miruAccount.authToken = token;
  miruAccount.baseUrl = normalizeMiruBaseUrl(baseUrl);
  miruAccount.company = company;
  miruAccount.companyRole =
    getStringField(data, "company_role") || getStringField(data, "companyRole");
  miruAccount.currentWorkspaceId =
    getIdField(user, "current_workspace_id") ??
    getIdField(user, "currentWorkspaceId") ??
    getIdField(company, "id") ??
    null;
  miruAccount.user = user;
  miruAccount.syncStatus = token ? "synced" : "error";
  miruAccount.syncError = token ? "" : "Miru did not return an API token.";
  persistAccountStateInBackground();

  return getMiruSessionSnapshot();
}

async function loginToMiru(payload: {
  baseUrl?: string;
  email: string;
  password: string;
}) {
  const baseUrl = normalizeMiruBaseUrl(payload.baseUrl ?? miruAccount.baseUrl);
  const response = await miruRequest(
    "/users/login",
    {
      body: {
        app: "miru-desktop",
        user: {
          email: payload.email,
          locale: "en",
          password: payload.password,
        },
      },
      method: "POST",
      skipAuth: true,
    },
    baseUrl
  );

  const session = setMiruAccountFromAuth(response, baseUrl);
  await refreshWorkspaces();
  return { ...session, workspaces: miruAccount.workspaces };
}

async function signupToMiru(payload: {
  baseUrl?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  password: string;
}) {
  const baseUrl = normalizeMiruBaseUrl(payload.baseUrl ?? miruAccount.baseUrl);
  const response = await miruRequest(
    "/users/signup",
    {
      body: {
        user: {
          email: payload.email,
          first_name: payload.firstName ?? "",
          last_name: payload.lastName ?? "",
          locale: "en",
          password: payload.password,
        },
      },
      method: "POST",
      skipAuth: true,
    },
    baseUrl
  );

  const token =
    getStringField(getRecord(response.user), "token") ||
    getStringField(response, "auth_token") ||
    getStringField(response, "token");

  if (token) {
    const session = setMiruAccountFromAuth(response, baseUrl);
    await refreshWorkspaces();
    return { ...session, workspaces: miruAccount.workspaces };
  }

  miruAccount.baseUrl = baseUrl;
  miruAccount.syncStatus = "local";
  miruAccount.syncError =
    getStringField(response, "notice") ||
    "Account created. Confirm your email, then log in.";
  persistAccountStateInBackground();

  return getMiruSessionSnapshot();
}

async function logoutFromMiru() {
  if (miruAccount.authToken) {
    try {
      await miruRequest("/users/logout", { method: "DELETE" });
    } catch {
      // Local logout should still work when the server is unavailable.
    }
  }

  miruAccount.authEmail = "";
  miruAccount.authToken = "";
  miruAccount.company = null;
  miruAccount.companyRole = "";
  miruAccount.currentWorkspaceId = null;
  miruAccount.lastSyncAt = "";
  miruAccount.syncError = "";
  miruAccount.syncStatus = "local";
  miruAccount.user = null;
  miruAccount.workspaces = [];
  persistAccountStateInBackground();

  return getMiruSessionSnapshot();
}

async function refreshWorkspaces() {
  if (!miruAccount.authToken) {
    return;
  }

  const response = await miruRequest("/workspaces");
  miruAccount.workspaces = response.workspaces ?? [];
  persistAccountStateInBackground();
}

async function openGoogleLogin(baseUrl?: string) {
  const normalizedBaseUrl = normalizeMiruBaseUrl(
    baseUrl ?? miruAccount.baseUrl
  );
  miruAccount.baseUrl = normalizedBaseUrl;
  await import("electron").then(({ shell }) =>
    shell.openExternal(`${normalizedBaseUrl}/users/auth/google_oauth2`)
  );
  persistAccountStateInBackground();
  return getMiruSessionSnapshot();
}

function getMiruTimeTracking(
  payload: { from?: string; to?: string; userId?: number | string } = {}
) {
  if (!miruAccount.authToken) {
    throw new Error("Sign in to load Miru projects and time entries.");
  }

  const params = new URLSearchParams();
  if (payload.from) {
    params.set("from", payload.from);
  }
  if (payload.to) {
    params.set("to", payload.to);
  }
  if (payload.userId) {
    params.set("user_id", String(payload.userId));
  }

  return miruRequest(`/time-tracking${params.toString() ? `?${params}` : ""}`);
}

async function switchMiruWorkspace(workspaceId: number | string) {
  const response = await miruRequest(`/workspaces/${workspaceId}`, {
    method: "PUT",
  });
  miruAccount.currentWorkspaceId = workspaceId;
  miruAccount.company = response.company ?? miruAccount.company;
  await refreshWorkspaces();
  persistAccountStateInBackground();

  return getMiruSessionSnapshot();
}

async function syncCurrentTimer(action: "pull" | "push" = "push") {
  if (!miruAccount.authToken) {
    miruAccount.syncStatus = "local";
    miruAccount.syncError = "Sign in to sync with Miru web.";
    return { session: getMiruSessionSnapshot(), timer: getTimerSnapshot() };
  }

  miruAccount.syncStatus = "syncing";
  miruAccount.syncError = "";

  try {
    if (action === "pull") {
      const response = await miruRequest("/desktop/current_timer", {
        method: "GET",
      });
      applyRemoteTimer(response.current_timer ?? response.currentTimer);
    } else {
      await miruRequest("/desktop/current_timer", {
        body: { current_timer: buildRemoteTimerPayload() },
        method: "PUT",
      });
    }

    miruAccount.lastSyncAt = new Date().toISOString();
    miruAccount.syncStatus = "synced";
  } catch (error) {
    miruAccount.syncStatus = "offline";
    miruAccount.syncError =
      error instanceof Error ? error.message : "Current timer sync failed.";
  }

  persistAccountStateInBackground();
  updateTray();
  return { session: getMiruSessionSnapshot(), timer: getTimerSnapshot() };
}

async function saveTimerEntryToMiru(payload: {
  duration?: number;
  note?: string;
  projectId?: number | string;
  userId?: number | string;
  workDate?: string;
}) {
  if (!miruAccount.authToken) {
    throw new Error("Sign in to save time to Miru.");
  }

  const duration =
    payload.duration ?? Math.floor(currentElapsedMs() / 1000 / 60);
  if (duration < 1) {
    throw new Error("Track at least one minute before saving.");
  }

  const response = await miruRequest(
    payload.userId
      ? `/timesheet_entry?user_id=${payload.userId}`
      : "/timesheet_entry",
    {
      body: {
        project_id: payload.projectId,
        timesheet_entry: {
          bill_status: "non_billable",
          duration,
          note: payload.note ?? timerContext.notes,
          work_date: payload.workDate ?? new Date().toISOString().slice(0, 10),
        },
      },
      method: "POST",
    }
  );

  resetTrayTimer();
  return response;
}

function updateTimerEntryInMiru(payload: {
  duration?: number;
  entryId?: number | string;
  note?: string;
  projectId?: number | string;
  workDate?: string;
}) {
  if (!miruAccount.authToken) {
    throw new Error("Sign in to update Miru time entries.");
  }

  if (!payload.entryId) {
    throw new Error("Select an entry before updating it.");
  }

  return miruRequest(`/timesheet_entry/${payload.entryId}`, {
    body: {
      project_id: payload.projectId,
      timesheet_entry: {
        bill_status: "non_billable",
        duration: payload.duration,
        note: payload.note ?? "",
        work_date: payload.workDate,
      },
    },
    method: "PUT",
  });
}

function deleteTimerEntryFromMiru(entryId: number | string) {
  if (!miruAccount.authToken) {
    throw new Error("Sign in to delete Miru time entries.");
  }

  if (!entryId) {
    throw new Error("Select an entry before deleting it.");
  }

  return miruRequest(`/timesheet_entry/${entryId}`, {
    method: "DELETE",
  });
}

function buildRemoteTimerPayload() {
  return {
    billable: timerContext.billable,
    elapsed_ms: currentElapsedMs(),
    notes: timerContext.notes,
    project_name: timerContext.projectName,
    running: timerState.running,
    started_at: timerState.running
      ? new Date(timerState.startedAt).toISOString()
      : null,
    task_name: timerContext.taskName,
  };
}

function applyRemoteTimer(timer: unknown) {
  if (!timer) {
    return;
  }

  const remoteTimer = getRecord(timer);
  const elapsedMs = Math.max(
    0,
    getNumberField(remoteTimer, ["elapsed_ms", "elapsedMs"])
  );
  const startedAt = Date.parse(
    getStringField(remoteTimer, "started_at") ||
      getStringField(remoteTimer, "startedAt")
  );

  timerState.elapsedMs = elapsedMs;
  timerState.running = Boolean(remoteTimer.running);
  timerState.startedAt = getRemoteTimerStartedAt(timerState.running, startedAt);
  updateTimerContext(
    {
      billable: Boolean(remoteTimer.billable),
      notes: getStringField(remoteTimer, "notes"),
      projectName:
        getStringField(remoteTimer, "project_name") ||
        getStringField(remoteTimer, "projectName") ||
        timerContext.projectName,
      taskName:
        getStringField(remoteTimer, "task_name") ||
        getStringField(remoteTimer, "taskName") ||
        timerContext.taskName,
    },
    false
  );
}

function getRemoteTimerStartedAt(running: boolean, startedAt: number) {
  if (!running) {
    return 0;
  }

  return Number.isFinite(startedAt) ? startedAt : Date.now();
}

async function miruRequest(
  pathName: string,
  options: {
    body?: unknown;
    method?: "DELETE" | "GET" | "POST" | "PUT";
    skipAuth?: boolean;
  } = {},
  explicitBaseUrl = miruAccount.baseUrl
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (!(options.skipAuth ?? false)) {
    headers.Authorization = `Bearer ${miruAccount.authToken}`;
    headers["X-Auth-Email"] = miruAccount.authEmail;
    headers["X-Auth-Token"] = miruAccount.authToken;
  }

  try {
    const response = await fetch(
      `${normalizeMiruBaseUrl(explicitBaseUrl)}/api/v1${pathName}`,
      {
        body: options.body ? JSON.stringify(options.body) : undefined,
        headers,
        method: options.method ?? "GET",
        signal: controller.signal,
      }
    );

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(
        data.error || data.errors || `Miru API returned ${response.status}`
      );
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function scheduleTimerPersist() {
  if (saveTimer) {
    return;
  }

  saveTimer = setTimeout(() => {
    saveTimer = null;
    persistTimerStateInBackground();
  }, 1000);
}

function sanitizeTimerContext(context: unknown) {
  if (!(context && typeof context === "object")) {
    return {};
  }

  const input = context as Record<string, unknown>;
  const sanitized: Partial<typeof timerContext> = {};

  if (typeof input.projectName === "string") {
    sanitized.projectName = input.projectName.slice(0, 200);
  }

  if (typeof input.taskName === "string") {
    sanitized.taskName = input.taskName.slice(0, 120);
  }

  if (typeof input.notes === "string") {
    sanitized.notes = input.notes.slice(0, 2000);
  }

  if (typeof input.billable === "boolean") {
    sanitized.billable = input.billable;
  }

  return sanitized;
}

function sanitizeTimerSummary(summary: unknown) {
  if (!(summary && typeof summary === "object")) {
    return {};
  }

  const input = summary as Record<string, unknown>;
  const sanitized: Partial<typeof timerSummary> = {};

  if (typeof input.todayMinutes === "number") {
    sanitized.todayMinutes = Math.max(0, Math.round(input.todayMinutes));
  }

  if (typeof input.weekMinutes === "number") {
    sanitized.weekMinutes = Math.max(0, Math.round(input.weekMinutes));
  }

  if (typeof input.selectedDateMinutes === "number") {
    sanitized.selectedDateMinutes = Math.max(
      0,
      Math.round(input.selectedDateMinutes)
    );
  }

  if (typeof input.entryCount === "number") {
    sanitized.entryCount = Math.max(0, Math.round(input.entryCount));
  }

  if (typeof input.selectedDateLabel === "string") {
    sanitized.selectedDateLabel = input.selectedDateLabel.slice(0, 60);
  }

  if (typeof input.workspaceName === "string") {
    sanitized.workspaceName = input.workspaceName.slice(0, 120);
  }

  if (typeof input.userLabel === "string") {
    sanitized.userLabel = input.userLabel.slice(0, 120);
  }

  if (typeof input.syncStatus === "string") {
    sanitized.syncStatus = input.syncStatus.slice(0, 24);
  }

  return sanitized;
}

function updateTimerContext(
  context: Partial<typeof timerContext>,
  shouldRefresh = true
) {
  if (typeof context.projectName === "string") {
    timerContext.projectName = context.projectName || "No project selected";
  }

  if (typeof context.taskName === "string") {
    timerContext.taskName = context.taskName || "No task selected";
  }

  if (typeof context.notes === "string") {
    timerContext.notes = context.notes;
  }

  if (typeof context.billable === "boolean") {
    timerContext.billable = context.billable;
  }

  if (shouldRefresh) {
    updateTray();
  }
}

function updateTimerSummary(
  summary: Partial<typeof timerSummary>,
  shouldRefresh = true
) {
  Object.assign(timerSummary, summary);

  if (shouldRefresh) {
    updateTray({ persist: false });
  }
}

function setIdleThreshold(seconds: number) {
  if (!IDLE_THRESHOLDS.some((threshold) => threshold.seconds === seconds)) {
    return;
  }

  timerSettings.idleThresholdSeconds = seconds;
  idleSession = null;
  updateTray();
}

function toggleTrayTimer() {
  if (timerState.running) {
    return pauseTrayTimer();
  }

  return startTrayTimer();
}

function startTrayTimer() {
  if (timerState.running) {
    return getTimerSnapshot();
  }

  timerState.running = true;
  timerState.startedAt = Date.now();
  ensureTrayInterval();
  updateTray();

  return getTimerSnapshot();
}

function pauseTrayTimer() {
  if (!timerState.running) {
    return getTimerSnapshot();
  }

  timerState.elapsedMs = currentElapsedMs();
  timerState.running = false;
  timerState.startedAt = 0;
  updateTray();

  return getTimerSnapshot();
}

function resetTrayTimer() {
  timerState.elapsedMs = 0;
  timerState.running = false;
  timerState.startedAt = 0;
  idleSession = null;
  updateTray();

  return getTimerSnapshot();
}

function subtractIdleTime(idleMs: number) {
  timerState.elapsedMs = Math.max(0, currentElapsedMs() - idleMs);
  timerState.startedAt = timerState.running ? Date.now() : 0;
}

function applyIdleAction(action: IdleAction) {
  if (
    !["remove-continue", "remove-start-new", "ignore-continue"].includes(action)
  ) {
    return getTimerSnapshot();
  }

  const idleMs = idleSession
    ? Math.max(0, Date.now() - idleSession.startedAt)
    : 0;

  if (action === "remove-continue") {
    subtractIdleTime(idleMs);
    timerState.running = true;
    timerState.startedAt = Date.now();
  }

  if (action === "remove-start-new") {
    timerState.elapsedMs = 0;
    timerState.running = true;
    timerState.startedAt = Date.now();
  }

  if (action === "ignore-continue") {
    timerState.running = true;
    timerState.startedAt = timerState.startedAt || Date.now();
  }

  idleSession = null;
  updateTray();

  return getTimerSnapshot();
}

function ensureTrayInterval() {
  if (trayTimer) {
    return;
  }

  trayTimer = setInterval(() => updateTray({ persist: false }), 90);
}

function startIdleMonitor() {
  if (idleMonitor) {
    return;
  }

  idleMonitor = setInterval(checkIdleState, 5000);
  powerMonitor.on("resume", checkIdleState);
  powerMonitor.on("unlock-screen", checkIdleState);
}

function checkIdleState() {
  if (!timerState.running) {
    idleSession = null;
    return;
  }

  const idleSeconds = powerMonitor.getSystemIdleTime();

  if (idleSeconds >= timerSettings.idleThresholdSeconds && !idleSession) {
    idleSession = {
      prompted: false,
      startedAt: Date.now() - idleSeconds * 1000,
    };
    updateTray();
    return;
  }

  if (!(idleSession && idleSeconds < 10 && !idleSession.prompted)) {
    return;
  }

  idleSession.prompted = true;
  showIdlePrompt();
}

function forceIdleForTesting(durationMs: number) {
  idleSession = {
    prompted: false,
    startedAt: Date.now() - Math.max(0, durationMs),
  };
  updateTray();
}

function showIdlePrompt() {
  if (!idleSession) {
    return;
  }

  openMainWindow();
  updateTray();
}

function stopTrayInterval() {
  if (!trayTimer) {
    return;
  }

  clearInterval(trayTimer);
  trayTimer = null;
}

function currentElapsedMs() {
  if (!timerState.running) {
    return timerState.elapsedMs;
  }

  return timerState.elapsedMs + Date.now() - timerState.startedAt;
}

function getTimerSnapshot() {
  const elapsedMs = currentElapsedMs();

  return {
    context: { ...timerContext },
    elapsedMs,
    elapsedSeconds: Math.floor(elapsedMs / 1000),
    formatted: formatTrayDuration(elapsedMs),
    idle: idleSession
      ? {
          durationMs: Math.max(0, Date.now() - idleSession.startedAt),
          prompted: idleSession.prompted,
        }
      : null,
    idleThresholdSeconds: timerSettings.idleThresholdSeconds,
    running: timerState.running,
  };
}

function createTrayImage(snapshot: ReturnType<typeof getTimerSnapshot>) {
  const state = getTrayVisualState(snapshot);
  const frame = Math.floor(Date.now() / 90) % 40;
  const phase = frame / 40;
  const rotation = frame * 9;
  const wave = (Math.sin(phase * Math.PI * 2) + 1) / 2;
  const pulse = 0.72 + wave * 0.24;
  const image = nativeImage.createFromBuffer(
    renderTrayPng({
      activityOpacity: pulse,
      glow: wave,
      rotation,
      state,
    }),
    { scaleFactor: 2 }
  );

  image.setTemplateImage(false);
  latestTrayImageState = { ...image.getSize(), empty: image.isEmpty() };
  return image;
}

function getTrayVisualState(snapshot: ReturnType<typeof getTimerSnapshot>) {
  if (snapshot.idle) {
    return "idle";
  }

  if (snapshot.running) {
    return "running";
  }

  if (snapshot.elapsedMs > 0) {
    return "paused";
  }

  return "ready";
}

function getTrayPalette(state: ReturnType<typeof getTrayVisualState>) {
  const palettes = {
    idle: {
      accent: "#f59e0b",
      core: "#b45309",
      coreOpacity: 0.96,
      glyph: "#ffffff",
      halo: "#f59e0b",
      haloOpacity: 0.22,
      ringOpacity: 0.76,
    },
    paused: {
      accent: "#8b5cf6",
      core: "#5b34ea",
      coreOpacity: 0.94,
      glyph: "#ffffff",
      halo: "#8b5cf6",
      haloOpacity: 0.12,
      ringOpacity: 0.54,
    },
    ready: {
      accent: "#6b7280",
      core: "#ffffff",
      coreOpacity: 0.92,
      glyph: "#334155",
      halo: "#64748b",
      haloOpacity: 0.06,
      ringOpacity: 0.42,
    },
    running: {
      accent: "#10b981",
      core: "#5b34ea",
      coreOpacity: 0.96,
      glyph: "#ffffff",
      halo: "#14b8a6",
      haloOpacity: 0.2,
      ringOpacity: 0.82,
    },
  } as const;

  return palettes[state];
}

function renderTrayPng({
  activityOpacity,
  glow,
  rotation,
  state,
}: {
  activityOpacity: number;
  glow: number;
  rotation: number;
  state: ReturnType<typeof getTrayVisualState>;
}) {
  const size = 44;
  const center = 22;
  const pixels = new Uint8ClampedArray(size * size * 4);
  const palette = getTrayPalette(state);
  const accent = hexToRgba(palette.accent);
  const core = hexToRgba(palette.core);
  const glyph = hexToRgba(palette.glyph);
  const halo = hexToRgba(palette.halo);

  drawCircle(pixels, size, center, center + 0.8, 18, [0, 0, 0, 255], 0.08);
  drawCircle(
    pixels,
    size,
    center,
    center,
    16.2 + glow * 2.2,
    halo,
    palette.haloOpacity
  );

  if (state === "running") {
    drawArc(
      pixels,
      size,
      center,
      center,
      15.7,
      3.6,
      rotation,
      104,
      accent,
      palette.ringOpacity * activityOpacity
    );
    drawArc(
      pixels,
      size,
      center,
      center,
      15.7,
      2.2,
      rotation + 184,
      66,
      core,
      0.46 + glow * 0.18
    );
    drawOrbitDot(pixels, size, center, center, 15.7, rotation + 104, accent, 1);
    drawGlint(pixels, size, 12 + glow * 8);
  } else if (state === "idle") {
    drawDashedRing(
      pixels,
      size,
      center,
      center,
      15.8,
      3.6,
      rotation * 1.4,
      8,
      14,
      accent,
      palette.ringOpacity * (0.78 + glow * 0.2)
    );
    drawOrbitDot(
      pixels,
      size,
      center,
      center,
      15.8,
      rotation * 1.4,
      accent,
      0.9
    );
  } else if (state === "paused") {
    drawDashedRing(
      pixels,
      size,
      center,
      center,
      15.6,
      3,
      rotation * 0.45,
      16,
      10,
      accent,
      palette.ringOpacity * (0.6 + glow * 0.18)
    );
  } else {
    drawRing(pixels, size, center, center, 15.4, 1.6, accent, 0.28);
    drawArc(
      pixels,
      size,
      center,
      center,
      15.4,
      2.6,
      rotation * 0.5,
      52,
      accent,
      palette.ringOpacity * (0.48 + glow * 0.12)
    );
  }

  drawCircle(pixels, size, center, center, 10.8, core, palette.coreOpacity);
  drawGlyph(pixels, size, state, glyph);

  return encodePng(size, size, pixels);
}

function drawGlyph(
  pixels: Uint8ClampedArray,
  size: number,
  state: ReturnType<typeof getTrayVisualState>,
  color: Rgba
) {
  if (state === "running") {
    drawRoundedRect(pixels, size, 18, 14, 4, 16, 1.8, color, 1);
    drawRoundedRect(pixels, size, 26, 14, 4, 16, 1.8, color, 1);
    return;
  }

  if (state === "idle") {
    drawRoundedRect(pixels, size, 19.6, 12.2, 4.8, 14.8, 2.4, color, 1);
    drawCircle(pixels, size, 22, 32, 2.5, color, 1);
    return;
  }

  drawTriangle(
    pixels,
    size,
    [
      [18.4, 13.4],
      [18.4, 30.6],
      [32.4, 22],
    ],
    color,
    1
  );
}

function drawCircle(
  pixels: Uint8ClampedArray,
  size: number,
  cx: number,
  cy: number,
  radius: number,
  color: Rgba,
  opacity: number
) {
  const radiusSquared = radius * radius;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const distanceSquared = dx * dx + dy * dy;

      if (distanceSquared > radiusSquared) {
        continue;
      }

      const edge = Math.min(1, radius - Math.sqrt(distanceSquared));
      blendPixel(pixels, size, x, y, color, opacity * edge);
    }
  }
}

function drawRing(
  pixels: Uint8ClampedArray,
  size: number,
  cx: number,
  cy: number,
  radius: number,
  thickness: number,
  color: Rgba,
  opacity: number
) {
  drawArc(pixels, size, cx, cy, radius, thickness, 0, 360, color, opacity);
}

function drawDashedRing(
  pixels: Uint8ClampedArray,
  size: number,
  cx: number,
  cy: number,
  radius: number,
  thickness: number,
  rotation: number,
  dashDegrees: number,
  gapDegrees: number,
  color: Rgba,
  opacity: number
) {
  const step = dashDegrees + gapDegrees;

  for (let start = rotation; start < rotation + 360; start += step) {
    drawArc(
      pixels,
      size,
      cx,
      cy,
      radius,
      thickness,
      start,
      dashDegrees,
      color,
      opacity
    );
  }
}

function drawArc(
  pixels: Uint8ClampedArray,
  size: number,
  cx: number,
  cy: number,
  radius: number,
  thickness: number,
  startDegrees: number,
  sweepDegrees: number,
  color: Rgba,
  opacity: number
) {
  const inner = radius - thickness / 2;
  const outer = radius + thickness / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < inner || distance > outer) {
        continue;
      }

      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const normalized = (angle - startDegrees + 720) % 360;

      if (normalized > sweepDegrees) {
        continue;
      }

      const edge = Math.min(1, distance - inner, outer - distance);
      blendPixel(pixels, size, x, y, color, opacity * Math.max(0.35, edge));
    }
  }
}

function drawRoundedRect(
  pixels: Uint8ClampedArray,
  size: number,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: Rgba,
  opacity: number
) {
  for (let py = Math.floor(y); py <= Math.ceil(y + height); py += 1) {
    for (let px = Math.floor(x); px <= Math.ceil(x + width); px += 1) {
      const qx = Math.max(x + radius, Math.min(px + 0.5, x + width - radius));
      const qy = Math.max(y + radius, Math.min(py + 0.5, y + height - radius));
      const distance = Math.hypot(px + 0.5 - qx, py + 0.5 - qy);

      if (distance <= radius) {
        blendPixel(pixels, size, px, py, color, opacity);
      }
    }
  }
}

function drawTriangle(
  pixels: Uint8ClampedArray,
  size: number,
  points: [[number, number], [number, number], [number, number]],
  color: Rgba,
  opacity: number
) {
  const minX = Math.floor(Math.min(...points.map(([x]) => x)));
  const maxX = Math.ceil(Math.max(...points.map(([x]) => x)));
  const minY = Math.floor(Math.min(...points.map(([, y]) => y)));
  const maxY = Math.ceil(Math.max(...points.map(([, y]) => y)));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (pointInTriangle(x + 0.5, y + 0.5, points)) {
        blendPixel(pixels, size, x, y, color, opacity);
      }
    }
  }
}

function drawGlint(pixels: Uint8ClampedArray, size: number, x: number) {
  drawCircle(pixels, size, x, 9, 2.2, [255, 255, 255, 255], 0.22);
}

function drawOrbitDot(
  pixels: Uint8ClampedArray,
  size: number,
  cx: number,
  cy: number,
  radius: number,
  degrees: number,
  color: Rgba,
  opacity: number
) {
  const radians = (degrees * Math.PI) / 180;
  drawCircle(
    pixels,
    size,
    cx + Math.cos(radians) * radius,
    cy + Math.sin(radians) * radius,
    2.15,
    color,
    opacity
  );
}

function pointInTriangle(
  x: number,
  y: number,
  [[x1, y1], [x2, y2], [x3, y3]]: [
    [number, number],
    [number, number],
    [number, number],
  ]
) {
  const denominator = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
  const a = ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / denominator;
  const b = ((y3 - y1) * (x - x3) + (x1 - x3) * (y - y3)) / denominator;
  const c = 1 - a - b;

  return a >= 0 && b >= 0 && c >= 0;
}

function blendPixel(
  pixels: Uint8ClampedArray,
  size: number,
  x: number,
  y: number,
  [r, g, b, a]: Rgba,
  opacity: number
) {
  if (x < 0 || y < 0 || x >= size || y >= size || opacity <= 0) {
    return;
  }

  const index = (y * size + x) * 4;
  const sourceAlpha = (a / 255) * Math.min(1, opacity);
  const destinationAlpha = pixels[index + 3] / 255;
  const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);

  if (outputAlpha === 0) {
    return;
  }

  pixels[index] =
    (r * sourceAlpha + pixels[index] * destinationAlpha * (1 - sourceAlpha)) /
    outputAlpha;
  pixels[index + 1] =
    (g * sourceAlpha +
      pixels[index + 1] * destinationAlpha * (1 - sourceAlpha)) /
    outputAlpha;
  pixels[index + 2] =
    (b * sourceAlpha +
      pixels[index + 2] * destinationAlpha * (1 - sourceAlpha)) /
    outputAlpha;
  pixels[index + 3] = outputAlpha * 255;
}

function hexToRgba(value: string): Rgba {
  const hex = value.replace("#", "");

  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
    255,
  ];
}

function encodePng(width: number, height: number, pixels: Uint8ClampedArray) {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const raw = Buffer.alloc((width * 4 + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    Buffer.from(pixels.buffer, y * width * 4, width * 4).copy(
      raw,
      rowStart + 1
    );
  }

  return Buffer.concat([
    signature,
    pngChunk("IHDR", createPngHeader(width, height)),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function createPngHeader(width: number, height: number) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;
  return header;
}

function pngChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer: Buffer) {
  let crc = 0xff_ff_ff_ff;

  for (const byte of buffer) {
    // biome-ignore lint/suspicious/noBitwiseOperators: PNG CRC32 encoding is defined in bitwise terms.
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      // biome-ignore lint/suspicious/noBitwiseOperators: PNG CRC32 encoding is defined in bitwise terms.
      crc = crc & 1 ? 0xed_b8_83_20 ^ (crc >>> 1) : crc >>> 1;
    }
  }

  // biome-ignore lint/suspicious/noBitwiseOperators: PNG CRC32 encoding is defined in bitwise terms.
  return (crc ^ 0xff_ff_ff_ff) >>> 0;
}

function formatTrayNativeTitle(snapshot: ReturnType<typeof getTimerSnapshot>) {
  return snapshot.elapsedMs > 0
    ? formatTrayNativeDuration(snapshot.elapsedMs)
    : "--:--:--";
}

function formatTrayNativeDuration(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((unit) => String(unit).padStart(2, "0"))
    .join(":");
}

function getTrayStatusLabel(snapshot: ReturnType<typeof getTimerSnapshot>) {
  if (snapshot.idle) {
    return `Idle for ${formatLongDuration(snapshot.idle.durationMs)}`;
  }

  if (snapshot.running) {
    return `Tracking ${snapshot.formatted}`;
  }

  if (snapshot.elapsedMs > 0) {
    return `Paused at ${snapshot.formatted}`;
  }

  return "Ready to track";
}

function getTrayDetailLabel(snapshot: ReturnType<typeof getTimerSnapshot>) {
  if (snapshot.idle) {
    return "Choose how to handle idle time";
  }

  if (snapshot.running) {
    return "Timer running";
  }

  if (snapshot.elapsedMs > 0) {
    return "Timer paused";
  }

  return "Timer not started";
}

function getMenuAccountLabel() {
  const userName =
    timerSummary.userLabel ||
    getRecordString(miruAccount.user, ["name"]) ||
    [
      getRecordString(miruAccount.user, ["first_name", "firstName"]),
      getRecordString(miruAccount.user, ["last_name", "lastName"]),
    ]
      .filter(Boolean)
      .join(" ") ||
    miruAccount.authEmail;

  return `Account: ${userName || "Miru user"}`;
}

function getMenuWorkspaceName() {
  const workspace =
    timerSummary.workspaceName ||
    miruAccount.workspaces.find(
      (item) => String(item.id) === String(miruAccount.currentWorkspaceId)
    )?.name ||
    getRecordString(miruAccount.company, ["name"]) ||
    "Miru workspace";

  return `Workspace: ${workspace}`;
}

function getMenuSyncLabel() {
  const status = timerSummary.syncStatus || miruAccount.syncStatus;
  const labels: Record<string, string> = {
    error: "Error",
    local: "Local",
    offline: "Offline",
    synced: "Synced",
    syncing: "Syncing",
  };

  return labels[status] ?? status;
}

function getRecordString(
  record: Record<string, unknown> | null,
  keys: string[]
) {
  if (!record) {
    return "";
  }

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function formatMenuMinutes(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;

  if (hours === 0) {
    return `${remainder}m`;
  }

  if (remainder === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainder}m`;
}

function buildTrayMenu(snapshot: ReturnType<typeof getTimerSnapshot>) {
  const statusLabel = getTrayStatusLabel(snapshot);
  const signedIn = Boolean(miruAccount.authToken && miruAccount.authEmail);
  const menuTemplate: MenuItemConstructorOptions[] = [
    {
      enabled: false,
      label: "Miru Time Tracking",
    },
    {
      enabled: false,
      label: statusLabel,
    },
    ...(signedIn
      ? [
          { type: "separator" as const },
          {
            enabled: false,
            label: getMenuAccountLabel(),
          },
          {
            enabled: false,
            label: getMenuWorkspaceName(),
          },
          {
            enabled: false,
            label: `Sync: ${getMenuSyncLabel()}`,
          },
        ]
      : [
          { type: "separator" as const },
          {
            enabled: false,
            label: "Not signed in",
          },
        ]),
    { type: "separator" },
    {
      enabled: false,
      label: `Today: ${formatMenuMinutes(timerSummary.todayMinutes)}`,
    },
    {
      enabled: false,
      label: `Week: ${formatMenuMinutes(timerSummary.weekMinutes)}`,
    },
    {
      enabled: false,
      label: `${timerSummary.selectedDateLabel}: ${formatMenuMinutes(
        timerSummary.selectedDateMinutes
      )}`,
    },
    { type: "separator" },
    {
      enabled: false,
      label: getTrayDetailLabel(snapshot),
    },
    {
      enabled: false,
      label: `${timerContext.projectName}`,
    },
    {
      enabled: false,
      label: timerContext.taskName,
    },
    { type: "separator" },
    {
      accelerator: "CommandOrControl+Shift+Space",
      click: toggleTrayTimer,
      label: snapshot.running ? "Pause Timer" : "Start Timer",
    },
    {
      click: pauseTrayTimer,
      enabled: snapshot.running,
      label: "Stop Timer",
    },
    {
      click: resetTrayTimer,
      enabled: snapshot.elapsedMs > 0,
      label: "Reset Timer",
    },
    ...(idleSession
      ? [
          { type: "separator" as const },
          {
            enabled: false,
            label: `Idle detected: ${formatLongDuration(snapshot.idle?.durationMs ?? 0)}`,
          },
          {
            click: () => applyIdleAction("remove-continue"),
            label: "Remove Idle Time and Continue",
          },
          {
            click: () => applyIdleAction("remove-start-new"),
            label: "Remove Idle Time and Start New",
          },
          {
            click: () => applyIdleAction("ignore-continue"),
            label: "Ignore and Continue",
          },
        ]
      : []),
    { type: "separator" },
    {
      label: "Idle Detection",
      submenu: IDLE_THRESHOLDS.map((threshold) => ({
        checked: timerSettings.idleThresholdSeconds === threshold.seconds,
        click: () => setIdleThreshold(threshold.seconds),
        label: threshold.label,
        type: "radio" as const,
      })),
    },
    ...(signedIn
      ? [
          { type: "separator" as const },
          ...(miruAccount.workspaces.length > 1
            ? [
                {
                  label: "Switch Workspace",
                  submenu: miruAccount.workspaces.map((workspace) => ({
                    checked:
                      String(workspace.id) ===
                      String(miruAccount.currentWorkspaceId),
                    click: () => {
                      switchMiruWorkspace(workspace.id)
                        .then(() => syncCurrentTimer("pull"))
                        .catch((error) => {
                          console.error("Failed to switch workspace", error);
                        });
                    },
                    label: workspace.name,
                    type: "radio" as const,
                  })),
                },
              ]
            : []),
          {
            click: () => {
              syncCurrentTimer("pull").catch((error) => {
                console.error("Failed to pull current timer", error);
              });
            },
            label: "Pull Current Timer from Miru",
          },
          {
            click: () => {
              syncCurrentTimer("push").catch((error) => {
                console.error("Failed to push current timer", error);
              });
            },
            label: "Push Current Timer to Miru",
          },
          {
            click: () => {
              logoutFromMiru()
                .then(() => updateTray({ persist: false }))
                .catch((error) => {
                  console.error("Failed to log out from Miru", error);
                });
            },
            label: "Log Out",
          },
        ]
      : []),
    { type: "separator" },
    {
      click: toggleMainWindow,
      label:
        mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()
          ? "Hide Timer Window"
          : "Show Timer Window",
    },
    {
      click: () => app.quit(),
      label: "Quit Miru Time Tracking",
    },
  ];

  return Menu.buildFromTemplate(menuTemplate);
}

function showTrayMenu() {
  if (!tray) {
    return;
  }

  tray.popUpContextMenu(buildTrayMenu(getTimerSnapshot()));
}

function updateTray(options: { persist?: boolean } = {}) {
  if (!tray) {
    return;
  }

  const snapshot = getTimerSnapshot();
  const statusLabel = getTrayStatusLabel(snapshot);

  tray.setImage(createTrayImage(snapshot));
  tray.setTitle(formatTrayNativeTitle(snapshot));
  tray.setToolTip(`Miru Time Tracking - ${statusLabel}`);
  publishTimerState(snapshot);

  if (snapshot.running || options.persist !== false) {
    scheduleTimerPersist();
  }
}

function publishTimerState(snapshot = getTimerSnapshot()) {
  if (!(mainWindow && !mainWindow.isDestroyed())) {
    return;
  }

  mainWindow.webContents.send(TIMER_CHANNELS.state, snapshot);
}

function formatTrayDuration(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatLongDuration(milliseconds: number) {
  const totalMinutes = Math.max(1, Math.round(milliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
}

app.whenReady().then(async () => {
  try {
    setupTimerIPC();
    setupMiruApiIPC();
    setupNativeUiIPC();
    await loadTimerState();
    await loadAccountState();
    createWindow();
    createTray();
    await installExtensions();
    checkForUpdates();
    await setupORPC();
  } catch (error) {
    console.error("Error during app initialization:", error);
  }
});

app.on("before-quit", () => {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  stopTrayInterval();
  persistTimerStateInBackground();
  persistAccountStateInBackground();
  if (idleMonitor) {
    clearInterval(idleMonitor);
    idleMonitor = null;
  }
  powerMonitor.removeListener("resume", checkIdleState);
  powerMonitor.removeListener("unlock-screen", checkIdleState);
});

//osX only
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
//osX only ends
