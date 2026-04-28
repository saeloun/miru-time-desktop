import path from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  type MessageBoxOptions,
  type MenuItemConstructorOptions,
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
import { IPC_CHANNELS, inDevelopment } from "./constants";
import { getBasePath } from "./utils/path";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let trayTimer: NodeJS.Timeout | null = null;
let idleMonitor: NodeJS.Timeout | null = null;
let saveTimer: NodeJS.Timeout | null = null;
let idleSession: { prompted: boolean; startedAt: number } | null = null;

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
  baseUrl: "http://127.0.0.1:3000",
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
  start: "miru-timer:start",
  state: "miru-timer:state",
  toggle: "miru-timer:toggle",
};

const MIRU_API_CHANNELS = {
  getTimeTracking: "miru-api:get-time-tracking",
  getSession: "miru-api:get-session",
  googleLogin: "miru-api:google-login",
  login: "miru-api:login",
  logout: "miru-api:logout",
  saveTimerEntry: "miru-api:save-timer-entry",
  signup: "miru-api:signup",
  syncCurrentTimer: "miru-api:sync-current-timer",
  switchWorkspace: "miru-api:switch-workspace",
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
  tray.on("click", toggleMainWindow);
  tray.on("right-click", showTrayMenu);

  ensureTrayInterval();
  updateTray();
  startIdleMonitor();
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
  } catch (error: any) {
    if (error?.code === "ENOENT") {
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
  } catch (error: any) {
    if (error?.code === "ENOENT") {
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
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed || "http://127.0.0.1:3000";
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

function setMiruAccountFromAuth(data: Record<string, any>, baseUrl: string) {
  const user = data.user ?? {};
  const token = user.token ?? data.auth_token ?? data.token ?? "";

  miruAccount.authEmail = user.email ?? miruAccount.authEmail;
  miruAccount.authToken = token;
  miruAccount.baseUrl = normalizeMiruBaseUrl(baseUrl);
  miruAccount.company = data.company ?? null;
  miruAccount.companyRole = data.company_role ?? data.companyRole ?? "";
  miruAccount.currentWorkspaceId =
    user.current_workspace_id ??
    user.currentWorkspaceId ??
    data.company?.id ??
    null;
  miruAccount.user = user;
  miruAccount.syncStatus = token ? "synced" : "error";
  miruAccount.syncError = token ? "" : "Miru did not return an API token.";
  void persistAccountState();

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

  const session = setMiruAccountFromAuth(response, baseUrl);
  await refreshWorkspaces();
  return { ...session, workspaces: miruAccount.workspaces };
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
  void persistAccountState();

  return getMiruSessionSnapshot();
}

async function refreshWorkspaces() {
  if (!miruAccount.authToken) {
    return;
  }

  const response = await miruRequest("/workspaces");
  miruAccount.workspaces = response.workspaces ?? [];
  void persistAccountState();
}

async function openGoogleLogin(baseUrl?: string) {
  const normalizedBaseUrl = normalizeMiruBaseUrl(
    baseUrl ?? miruAccount.baseUrl
  );
  miruAccount.baseUrl = normalizedBaseUrl;
  await import("electron").then(({ shell }) =>
    shell.openExternal(`${normalizedBaseUrl}/users/auth/google_oauth2`)
  );
  void persistAccountState();
  return getMiruSessionSnapshot();
}

async function getMiruTimeTracking(
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
  void persistAccountState();

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

  void persistAccountState();
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

function applyRemoteTimer(timer: any) {
  if (!timer) {
    return;
  }

  timerState.elapsedMs = Math.max(0, timer.elapsed_ms ?? timer.elapsedMs ?? 0);
  timerState.running = Boolean(timer.running);
  timerState.startedAt = timerState.running ? Date.now() : 0;
  updateTimerContext(
    {
      billable: Boolean(timer.billable),
      notes: timer.notes ?? "",
      projectName:
        timer.project_name ?? timer.projectName ?? timerContext.projectName,
      taskName: timer.task_name ?? timer.taskName ?? timerContext.taskName,
    },
    false
  );
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
    headers["Authorization"] = `Bearer ${miruAccount.authToken}`;
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
    void persistTimerState();
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

  trayTimer = setInterval(() => updateTray({ persist: false }), 250);
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

async function showIdlePrompt() {
  if (!idleSession) {
    return;
  }

  const idleMs = Math.max(0, Date.now() - idleSession.startedAt);
  openMainWindow();

  const options: MessageBoxOptions = {
    buttons: [
      "Remove idle time and continue",
      "Remove idle time and start new",
      "Ignore and continue",
    ],
    cancelId: 2,
    defaultId: 0,
    detail: `${formatLongDuration(idleMs)} can be removed from the current timer.`,
    message: "You were idle while the timer was running.",
    noLink: true,
    type: "question",
  };
  const result =
    mainWindow && !mainWindow.isDestroyed()
      ? await dialog.showMessageBox(mainWindow, options)
      : await dialog.showMessageBox(options);

  const action: IdleAction =
    result.response === 0
      ? "remove-continue"
      : result.response === 1
        ? "remove-start-new"
        : "ignore-continue";

  applyIdleAction(action);
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
  const frame = Math.floor(Date.now() / 250) % 8;
  const palette = getTrayPalette(state);
  const rotation = frame * 45;
  const pulse = 0.78 + (frame % 4) * 0.05;
  const glyph = getTrayGlyph(state);
  const halo =
    state === "running"
      ? `<circle cx="11" cy="11" r="${5.2 + (frame % 4) * 0.35}" fill="${palette.accent}" opacity="0.18"/>`
      : state === "idle"
        ? `<circle cx="11" cy="11" r="${6.5 + (frame % 2) * 0.65}" fill="${palette.accent}" opacity="0.24"/>`
        : "";
  const activity =
    state === "running"
      ? `<circle cx="11" cy="11" r="8.35" fill="none" stroke="${palette.accent}" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="11 42" transform="rotate(${rotation} 11 11)" opacity="${pulse.toFixed(2)}"/>`
      : state === "idle"
        ? `<circle cx="11" cy="11" r="8.2" fill="none" stroke="${palette.accent}" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="4 6" transform="rotate(${rotation * 1.5} 11 11)" opacity="${0.7 + (frame % 2) * 0.25}"/>`
        : state === "paused"
          ? `<circle cx="11" cy="11" r="8.1" fill="none" stroke="${palette.accent}" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="1.8 4.6" transform="rotate(${rotation} 11 11)" opacity="0.76"/>`
          : state === "ready"
            ? `<circle cx="11" cy="11" r="8.1" fill="none" stroke="${palette.accent}" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="5 46" transform="rotate(${rotation} 11 11)" opacity="0.62"/>`
            : "";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
      <defs>
        <linearGradient id="surface" x1="4" x2="18" y1="3" y2="19" gradientUnits="userSpaceOnUse">
          <stop stop-color="${palette.highlight}"/>
          <stop offset="1" stop-color="${palette.background}"/>
        </linearGradient>
        <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0.7" stdDeviation="0.55" flood-color="#000000" flood-opacity="0.24"/>
        </filter>
      </defs>
      <circle cx="11" cy="11" r="9.4" fill="url(#surface)" filter="url(#soft-shadow)"/>
      <circle cx="11" cy="11" r="9" fill="none" stroke="${palette.border}" stroke-width="1"/>
      ${halo}
      ${activity}
      <g fill="${palette.glyph}">${glyph}</g>
    </svg>
  `;
  const image = nativeImage.createFromDataURL(
    `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  );

  image.setTemplateImage(false);
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
      accent: "#facc15",
      background: "#9a3412",
      border: "#f59e0b",
      glyph: "#ffffff",
      highlight: "#f97316",
    },
    paused: {
      accent: "#c4b5fd",
      background: "#4c4563",
      border: "#8b7fc0",
      glyph: "#ffffff",
      highlight: "#756c92",
    },
    ready: {
      accent: "#c4c7cf",
      background: "#2f3138",
      border: "#6b7280",
      glyph: "#ffffff",
      highlight: "#4b5563",
    },
    running: {
      accent: "#c4b5fd",
      background: "#4c1d95",
      border: "#a78bfa",
      glyph: "#ffffff",
      highlight: "#7c3aed",
    },
  } as const;

  return palettes[state];
}

function getTrayGlyph(state: ReturnType<typeof getTrayVisualState>) {
  if (state === "running") {
    return `
      <rect x="8" y="6.7" width="2.2" height="8.6" rx="1"/>
      <rect x="11.8" y="6.7" width="2.2" height="8.6" rx="1"/>
    `;
  }

  if (state === "idle") {
    return `
      <rect x="9.8" y="5.8" width="2.4" height="8" rx="1.2"/>
      <circle cx="11" cy="16.2" r="1.35"/>
    `;
  }

  return `<path d="M8.2 6.4v9.2l7.4-4.6z"/>`;
}

function formatTrayTitle(snapshot: ReturnType<typeof getTimerSnapshot>) {
  if (snapshot.idle) {
    return `Idle ${snapshot.formatted}`;
  }

  if (snapshot.running || snapshot.elapsedMs > 0) {
    return snapshot.formatted;
  }

  return "--:--";
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

function buildTrayMenu(snapshot: ReturnType<typeof getTimerSnapshot>) {
  const statusLabel = getTrayStatusLabel(snapshot);
  const menuTemplate: MenuItemConstructorOptions[] = [
    {
      enabled: false,
      label: `Miru Time - ${statusLabel}`,
    },
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
  tray.setTitle(formatTrayTitle(snapshot));
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
  void persistTimerState();
  void persistAccountState();
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
