const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('notaryDesktop', {
  platform: process.platform,
  requestRdService: (request) => ipcRenderer.invoke('rd-service:request', request),
  getDownloadedUpdate: () => ipcRenderer.invoke('updater:get-downloaded-update'),
  restartAndInstallUpdate: () => ipcRenderer.invoke('updater:restart-and-install'),
  onUpdateDownloaded: (callback) => {
    const listener = (_event, updateInfo) => callback(updateInfo);
    ipcRenderer.on('updater:update-downloaded', listener);
    return () => ipcRenderer.removeListener('updater:update-downloaded', listener);
  },
});
