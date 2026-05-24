const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('notaryDesktop', {
  platform: process.platform,
  requestRdService: (request) => ipcRenderer.invoke('rd-service:request', request),
});
