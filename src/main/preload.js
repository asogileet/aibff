const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  moveWindow: (delta) => ipcRenderer.send('window:move', delta),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  setRestingMode: (resting) => ipcRenderer.send('window:set-resting-mode', resting),
  setStartup: (enable) => ipcRenderer.send('app:set-startup', enable),

  // Event Listeners from Main Process (Tray / Shortcuts)
  onReturn: (callback) => ipcRenderer.on('action:return', () => callback()),
  onLeave: (callback) => ipcRenderer.on('action:leave', () => callback()),
  onCostumeChange: (callback) => ipcRenderer.on('action:costume', (event, costume) => callback(costume)),
  onOpenSettings: (callback) => ipcRenderer.on('ui:open-settings', () => callback())
});
