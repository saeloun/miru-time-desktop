import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  type MessageBoxOptions,
  type MenuItemConstructorOptions,
  nativeImage,
  powerMonitor,
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
  billable: true,
  notes: "",
  projectName: "No project selected",
  taskName: "Development",
};

const timerSettings = {
  idleThresholdSeconds: 300,
};

const TIMER_CHANNELS = {
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

type IdleAction = "remove-continue" | "remove-start-new" | "ignore-continue";

interface StoredTimerState {
  context?: Partial<typeof timerContext>;
  elapsedMs?: number;
  idleThresholdSeconds?: number;
  running?: boolean;
  savedAt?: number;
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }

  const basePath = getBasePath();
  const preload = path.join(basePath, "preload.js");
  mainWindow = new BrowserWindow({
    minHeight: 760,
    minWidth: 1180,
    title: "Miru Time Desktop",
    width: 1320,
    height: 860,
    webPreferences: {
      devTools: inDevelopment,
      contextIsolation: true,
      nodeIntegration: true,
      nodeIntegrationInSubFrames: false,

      preload,
    },
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    trafficLightPosition:
      process.platform === "darwin" ? { x: 5, y: 5 } : undefined,
  });
  ipcContext.setMainWindow(mainWindow);

  mainWindow.on("closed", () => {
    mainWindow = null;
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
    updateTimerContext(context);
    return getTimerSnapshot();
  });
  ipcMain.handle(TIMER_CHANNELS.setIdleThreshold, (_event, seconds: number) => {
    setIdleThreshold(seconds);
    return getTimerSnapshot();
  });
  ipcMain.handle(TIMER_CHANNELS.idleAction, (_event, action: IdleAction) =>
    applyIdleAction(action)
  );
}

function createTray() {
  if (tray) {
    return;
  }

  const image = nativeImage.createFromDataURL(
    `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
        <circle cx="9" cy="9" r="7" fill="none" stroke="black" stroke-width="2"/>
        <path d="M9 4.5v5l3.25 2" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `)}`
  );
  image.setTemplateImage(true);

  tray = new Tray(image);
  tray.setToolTip("Miru Time Desktop");
  tray.on("click", () => {
    openMainWindow();
  });

  if (timerState.running && !trayTimer) {
    trayTimer = setInterval(updateTray, 1000);
  }

  updateTray();
  startIdleMonitor();
}

function openMainWindow() {
  const window = createWindow();

  if (window.isMinimized()) {
    window.restore();
  }

  window.show();
  window.focus();
}

function timerStorePath() {
  return path.join(app.getPath("userData"), "timer-state.json");
}

function loadTimerState() {
  const filePath = timerStorePath();

  if (!existsSync(filePath)) {
    return;
  }

  try {
    const stored = JSON.parse(
      readFileSync(filePath, "utf8")
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
  } catch (error) {
    console.error("Failed to load timer state", error);
  }
}

function persistTimerState() {
  try {
    const filePath = timerStorePath();
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(
      filePath,
      JSON.stringify(
        {
          context: timerContext,
          elapsedMs: currentElapsedMs(),
          idleThresholdSeconds: timerSettings.idleThresholdSeconds,
          running: timerState.running,
          savedAt: Date.now(),
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error("Failed to persist timer state", error);
  }
}

function scheduleTimerPersist() {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    saveTimer = null;
    persistTimerState();
  }, 250);
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
  if (![60, 300, 600, 900, 1800].includes(seconds)) {
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
  updateTray();

  if (!trayTimer) {
    trayTimer = setInterval(updateTray, 1000);
  }

  return getTimerSnapshot();
}

function pauseTrayTimer() {
  if (!timerState.running) {
    return getTimerSnapshot();
  }

  timerState.elapsedMs = currentElapsedMs();
  timerState.running = false;
  timerState.startedAt = 0;
  stopTrayInterval();
  updateTray();

  return getTimerSnapshot();
}

function resetTrayTimer() {
  timerState.elapsedMs = 0;
  timerState.running = false;
  timerState.startedAt = 0;
  idleSession = null;
  stopTrayInterval();
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

  const idleMs = idleSession ? Math.max(0, Date.now() - idleSession.startedAt) : 0;

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

function updateTray() {
  if (!tray) {
    return;
  }

  const snapshot = getTimerSnapshot();
  const elapsed = snapshot.formatted;
  const menuTemplate: MenuItemConstructorOptions[] = [
    {
      enabled: false,
      label: snapshot.running ? `Tracking ${elapsed}` : `Paused at ${elapsed}`,
    },
    {
      enabled: false,
      label: `${timerContext.projectName} / ${timerContext.taskName}`,
    },
    {
      enabled: false,
      label: timerContext.billable ? "Billable" : "Non-billable",
    },
    { type: "separator" },
    {
      accelerator: "CommandOrControl+Shift+Space",
      click: toggleTrayTimer,
      label: snapshot.running ? "Pause Timer" : "Start Timer",
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
      submenu: [
        {
          checked: timerSettings.idleThresholdSeconds === 60,
          click: () => setIdleThreshold(60),
          label: "After 1 minute",
          type: "radio",
        },
        {
          checked: timerSettings.idleThresholdSeconds === 300,
          click: () => setIdleThreshold(300),
          label: "After 5 minutes",
          type: "radio",
        },
        {
          checked: timerSettings.idleThresholdSeconds === 600,
          click: () => setIdleThreshold(600),
          label: "After 10 minutes",
          type: "radio",
        },
        {
          checked: timerSettings.idleThresholdSeconds === 900,
          click: () => setIdleThreshold(900),
          label: "After 15 minutes",
          type: "radio",
        },
        {
          checked: timerSettings.idleThresholdSeconds === 1800,
          click: () => setIdleThreshold(1800),
          label: "After 30 minutes",
          type: "radio",
        },
      ],
    },
    { type: "separator" },
    {
      click: openMainWindow,
      label: "Open Miru Time",
    },
    {
      click: () => app.quit(),
      label: "Quit Miru Time",
    },
  ];

  tray.setTitle(elapsed);
  tray.setContextMenu(Menu.buildFromTemplate(menuTemplate));
  publishTimerState(snapshot);
  scheduleTimerPersist();
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
    loadTimerState();
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
  persistTimerState();
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
