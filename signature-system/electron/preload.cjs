const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('signatureTerminal', {
  saveSignature: (payload) => ipcRenderer.invoke('signature:save', payload),
  enterFullscreen: () => ipcRenderer.invoke('window:fullscreen'),
})
