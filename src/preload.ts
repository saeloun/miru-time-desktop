import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "./constants";

const TIMER_CHANNELS = {
  getState: "miru-timer:get-state",
  pause: "miru-timer:pause",
  reset: "miru-timer:reset",
  start: "miru-timer:start",
  state: "miru-timer:state",
  toggle: "miru-timer:toggle",
};

contextBridge.exposeInMainWorld("miruTimer", {
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
  pause: () => ipcRenderer.invoke(TIMER_CHANNELS.pause),
  reset: () => ipcRenderer.invoke(TIMER_CHANNELS.reset),
  start: () => ipcRenderer.invoke(TIMER_CHANNELS.start),
  toggle: () => ipcRenderer.invoke(TIMER_CHANNELS.toggle),
});

window.addEventListener("message", (event) => {
  if (event.data === IPC_CHANNELS.START_ORPC_SERVER) {
    const [serverPort] = event.ports;

    ipcRenderer.postMessage(IPC_CHANNELS.START_ORPC_SERVER, null, [serverPort]);
  }
});
