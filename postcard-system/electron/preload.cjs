const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('postcardTerminal', {
  savePostcard: (payload) => ipcRenderer.invoke('postcard:save', payload),
  exportPostcard: (payload) => ipcRenderer.invoke('postcard:export', payload),
  printPostcard: (payload) => ipcRenderer.invoke('postcard:print', payload),
  cachePostcardImage: (payload) => ipcRenderer.invoke('postcard:cache-image', payload),
  createPhotoUpload: () => ipcRenderer.invoke('photo:create-upload'),
  pollPhotoUpload: (token) => ipcRenderer.invoke('photo:poll-upload', token),
  cancelPhotoUpload: (token) => ipcRenderer.invoke('photo:cancel-upload', token),
  getPrinters: () => ipcRenderer.invoke('printer:list'),
  enterFullscreen: () => ipcRenderer.invoke('window:fullscreen'),
  openOperatorWindow: () => ipcRenderer.invoke('window:operator'),
  closeOperatorWindow: () => ipcRenderer.invoke('window:close-operator'),
})
