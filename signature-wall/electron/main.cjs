const { app, BrowserWindow, Menu } = require('electron')
const path = require('node:path')

async function createWindow() {
  const devUrl = process.env.VITE_DEV_SERVER_URL
  Menu.setApplicationMenu(null)
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1024,
    minHeight: 650,
    fullscreen: true,
    kiosk: !devUrl,
    autoHideMenuBar: true,
    backgroundColor: '#f6f3ec',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })
  if (devUrl) await win.loadURL(devUrl)
  else await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
