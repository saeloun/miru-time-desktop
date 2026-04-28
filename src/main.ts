import path from "node:path";
import {
  app,
  BrowserWindow,
  Menu,
  type MenuItemConstructorOptions,
  nativeImage,
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

const timerState = {
  elapsedMs: 0,
  running: false,
  startedAt: 0,
};

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

  updateTray();
}

function openMainWindow() {
  const window = createWindow();

  if (window.isMinimized()) {
    window.restore();
  }

  window.show();
  window.focus();
}

function toggleTrayTimer() {
  if (timerState.running) {
    pauseTrayTimer();
    return;
  }

  startTrayTimer();
}

function startTrayTimer() {
  if (timerState.running) {
    return;
  }

  timerState.running = true;
  timerState.startedAt = Date.now();
  updateTray();

  if (!trayTimer) {
    trayTimer = setInterval(updateTray, 1000);
  }
}

function pauseTrayTimer() {
  if (!timerState.running) {
    return;
  }

  timerState.elapsedMs = currentElapsedMs();
  timerState.running = false;
  timerState.startedAt = 0;
  stopTrayInterval();
  updateTray();
}

function resetTrayTimer() {
  timerState.elapsedMs = 0;
  timerState.running = false;
  timerState.startedAt = 0;
  stopTrayInterval();
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

function updateTray() {
  if (!tray) {
    return;
  }

  const elapsed = formatTrayDuration(currentElapsedMs());
  const menuTemplate: MenuItemConstructorOptions[] = [
    {
      enabled: false,
      label: timerState.running ? `Tracking ${elapsed}` : `Paused at ${elapsed}`,
    },
    { type: "separator" },
    {
      accelerator: "CommandOrControl+Shift+Space",
      click: toggleTrayTimer,
      label: timerState.running ? "Pause Timer" : "Start Timer",
    },
    {
      click: resetTrayTimer,
      enabled: currentElapsedMs() > 0,
      label: "Reset Timer",
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

app.whenReady().then(async () => {
  try {
    createWindow();
    createTray();
    await installExtensions();
    checkForUpdates();
    await setupORPC();
  } catch (error) {
    console.error("Error during app initialization:", error);
  }
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
