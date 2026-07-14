const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('spectralDesktop', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  cancelSettings: () => ipcRenderer.send('settings:cancel')
});
