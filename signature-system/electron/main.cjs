const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')

function dataUrlToBuffer(dataUrl) {
  const base64 = dataUrl.split(',')[1]
  if (!base64) throw new Error('无效的图片数据')
  return Buffer.from(base64, 'base64')
}

async function createWindow() {
  const devUrl = process.env.VITE_DEV_SERVER_URL
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1024,
    minHeight: 720,
    fullscreen: true,
    kiosk: !devUrl,
    autoHideMenuBar: true,
    backgroundColor: '#f6f3ec',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (devUrl) await win.loadURL(devUrl)
  else await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

ipcMain.handle('signature:save', async (_event, payload) => {
  const safeId = String(payload.record.id).replace(/[^a-zA-Z0-9-_]/g, '')
  const outputDir = path.join(app.getPath('userData'), 'signatures', safeId)
  await fs.mkdir(outputDir, { recursive: true })

  const manifest = {
    ...payload.record,
    files: {
      raw: 'raw.json',
      vector: 'signature.svg',
      display: 'display.png',
      jpg: 'display.jpg',
      print: 'print.png',
      thumbnail: 'thumbnail.png',
    },
  }

  await Promise.all([
    fs.writeFile(path.join(outputDir, 'raw.json'), JSON.stringify(payload.record, null, 2), 'utf8'),
    fs.writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8'),
    fs.writeFile(path.join(outputDir, 'signature.svg'), payload.svg, 'utf8'),
    fs.writeFile(path.join(outputDir, 'display.png'), dataUrlToBuffer(payload.displayPng)),
    fs.writeFile(path.join(outputDir, 'display.jpg'), dataUrlToBuffer(payload.displayJpg)),
    fs.writeFile(path.join(outputDir, 'print.png'), dataUrlToBuffer(payload.printPng)),
    fs.writeFile(path.join(outputDir, 'thumbnail.png'), dataUrlToBuffer(payload.thumbnailPng)),
  ])

  return { ok: true, path: outputDir }
})

ipcMain.handle('window:fullscreen', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.setFullScreen(true)
  return true
})

app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
