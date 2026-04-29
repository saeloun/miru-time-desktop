import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "./constants";

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

contextBridge.exposeInMainWorld("miruTimer", {
  forceIdleForTesting: (durationMs: number) =>
    ipcRenderer.invoke(TIMER_CHANNELS.forceIdleForTesting, durationMs),
  getState: () => ipcRenderer.invoke(TIMER_CHANNELS.getState),
  onStateChange: (callback: (state: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: unknown) => {
      callback(state);
    };

    ipcRenderer.on(TIMER_CHANNELS.state, listener);

    return () => {
      ipcRenderer.removeListener(TIMER_CHANNELS.state, listener);
    };
  },
  applyIdleAction: (action: string) =>
    ipcRenderer.invoke(TIMER_CHANNELS.idleAction, action),
  pause: () => ipcRenderer.invoke(TIMER_CHANNELS.pause),
  reset: () => ipcRenderer.invoke(TIMER_CHANNELS.reset),
  setContext: (context: unknown) =>
    ipcRenderer.invoke(TIMER_CHANNELS.setContext, context),
  setIdleThreshold: (seconds: number) =>
    ipcRenderer.invoke(TIMER_CHANNELS.setIdleThreshold, seconds),
  setSummary: (summary: unknown) =>
    ipcRenderer.invoke(TIMER_CHANNELS.setSummary, summary),
  start: () => ipcRenderer.invoke(TIMER_CHANNELS.start),
  toggle: () => ipcRenderer.invoke(TIMER_CHANNELS.toggle),
});

contextBridge.exposeInMainWorld("miruApi", {
  getTimeTracking: (payload: unknown) =>
    ipcRenderer.invoke(MIRU_API_CHANNELS.getTimeTracking, payload),
  getSession: () => ipcRenderer.invoke(MIRU_API_CHANNELS.getSession),
  googleLogin: (baseUrl?: string) =>
    ipcRenderer.invoke(MIRU_API_CHANNELS.googleLogin, baseUrl),
  login: (payload: unknown) => ipcRenderer.invoke(MIRU_API_CHANNELS.login, payload),
  logout: () => ipcRenderer.invoke(MIRU_API_CHANNELS.logout),
  saveTimerEntry: (payload: unknown) =>
    ipcRenderer.invoke(MIRU_API_CHANNELS.saveTimerEntry, payload),
  signup: (payload: unknown) =>
    ipcRenderer.invoke(MIRU_API_CHANNELS.signup, payload),
  switchWorkspace: (workspaceId: number | string) =>
    ipcRenderer.invoke(MIRU_API_CHANNELS.switchWorkspace, workspaceId),
  syncCurrentTimer: (action?: "pull" | "push") =>
    ipcRenderer.invoke(MIRU_API_CHANNELS.syncCurrentTimer, action),
});

contextBridge.exposeInMainWorld("nativeDialog", {
  closeWindow: () => ipcRenderer.invoke(NATIVE_UI_CHANNELS.closeWindow),
  confirmDeleteTimeEntry: () =>
    ipcRenderer.invoke(NATIVE_UI_CHANNELS.confirmDeleteTimeEntry),
  minimizeWindow: () => ipcRenderer.invoke(NATIVE_UI_CHANNELS.minimizeWindow),
  quitApp: () => ipcRenderer.invoke(NATIVE_UI_CHANNELS.quitApp),
});

window.addEventListener("message", (event) => {
  if (event.data === IPC_CHANNELS.START_ORPC_SERVER) {
    const [serverPort] = event.ports;

    ipcRenderer.postMessage(IPC_CHANNELS.START_ORPC_SERVER, null, [serverPort]);
  }
});
