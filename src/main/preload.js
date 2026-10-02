const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  moveWindow: (delta) => ipcRenderer.send('window:move', delta),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  setRestingMode: (resting) => ipcRenderer.send('window:set-resting-mode', resting),
  setStartup: (enable) => ipcRenderer.send('app:set-startup', enable),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
  setIgnoreMouseEvents: (ignore, forward) => ipcRenderer.send('window:set-ignore-mouse-events', { ignore, forward }),

  // File & Snapshot Operations
  saveSnapshot: (payload) => ipcRenderer.invoke('app:save-snapshot', payload),
  openPath: (targetPath) => ipcRenderer.invoke('app:open-path', targetPath),

  // Local Config Persistence
  loadConfig: () => ipcRenderer.invoke('app:load-config'),
  saveConfig: (cfg) => ipcRenderer.invoke('app:save-config', cfg),

  // Multi-Monitor Layout Operations
  getDisplayLayout: () => ipcRenderer.invoke('window:get-display-layout'),
  onDisplayMetricsChanged: (callback) => ipcRenderer.on('window:display-metrics-changed', (event, data) => callback(data)),

  // Event Listeners from Main Process (Tray / Shortcuts)
  onReturn: (callback) => ipcRenderer.on('action:return', () => callback()),
  onLeave: (callback) => ipcRenderer.on('action:leave', () => callback()),
  onToggleView: (callback) => ipcRenderer.on('action:toggle-view', () => callback()),
  onCostumeChange: (callback) => ipcRenderer.on('action:costume', (event, costume) => callback(costume)),
  onOpenSettings: (callback) => ipcRenderer.on('ui:open-settings', () => callback())
});
