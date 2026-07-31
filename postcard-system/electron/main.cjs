const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const { createServer } = require('node:http')
const { networkInterfaces } = require('node:os')
const { randomBytes } = require('node:crypto')
const path = require('node:path')
const fs = require('node:fs/promises')
const { printImageFile } = require('./image-print.cjs')
const { chooseLocalAddress } = require('./network-address.cjs')

let mainWindow
let pickupServer
const pickupPort = Number(process.env.POSTCARD_PICKUP_PORT || 8790)
const photoUploads = new Map()
const photoUploadTtl = 10 * 60 * 1000

function dataUrlToBuffer(dataUrl) {
  const match = String(dataUrl || '').match(/^data:[^;,]+;base64,(.+)$/s)
  if (!match) throw new Error('无效的图片数据')
  return Buffer.from(match[1], 'base64')
}

function safeId(value) {
  const id = String(value || '').replace(/[^a-zA-Z0-9-_]/g, '')
  if (!id) throw new Error('无效的明信片编号')
  return id
}

function localAddress() {
  return chooseLocalAddress(networkInterfaces(), process.env.POSTCARD_PICKUP_HOST)
}

function pickupBase() {
  return String(process.env.POSTCARD_PICKUP_BASE_URL || `http://${localAddress()}:${pickupPort}/download`).replace(/\/$/, '')
}

function uploadBase() {
  return String(process.env.POSTCARD_UPLOAD_BASE_URL || `http://${localAddress()}:${pickupPort}/photo-upload`).replace(/\/$/, '')
}

function postcardRoot() {
  return path.join(app.getPath('userData'), 'postcards')
}

async function purgeExpiredPostcardFiles() {
  const cutoff = Date.now() - Math.max(1, Number(process.env.POSTCARD_RESULT_RETENTION_DAYS || 14)) * 86400000
  const entries = await fs.readdir(postcardRoot(), { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = path.join(postcardRoot(), entry.name)
    try {
      const manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'))
      if (new Date(manifest.createdAt || manifest.created_at || 0).getTime() < cutoff) await fs.rm(dir, { recursive: true, force: true })
    } catch { /* Ignore incomplete folders; the operator can inspect them manually. */ }
  }
}

function cleanExpiredPhotoUploads() {
  const now = Date.now()
  for (const [token, upload] of photoUploads) if (upload.expiresAt <= now) photoUploads.delete(token)
}

function readJsonBody(req, limit = 22 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('照片不能超过 15MB'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) }
      catch { reject(new Error('照片数据无效')) }
    })
    req.on('error', reject)
  })
}

function mobileUploadPage(token) {
  const safeToken = JSON.stringify(token)
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>上传校友照片</title><style>
  :root{color:#30312d;background:#f6f3ec;font-family:system-ui,"PingFang SC",sans-serif}*{box-sizing:border-box}body{margin:0}.page{max-width:620px;margin:auto;padding:28px 20px 54px}.eyebrow{color:#9f2925;font-size:12px;letter-spacing:.18em}.card{margin-top:22px;padding:24px;border:1px solid #ddd6ca;border-radius:14px;background:#fbfaf6;box-shadow:0 18px 45px #493a2612}h1{margin:8px 0;font-family:serif;font-weight:500;letter-spacing:.08em}p{color:#77746b;line-height:1.7}.pick{display:grid;min-height:180px;margin:22px 0;place-items:center;border:1px dashed #cfc7bb;border-radius:12px;background:#fffefb;color:#9f2925;text-align:center}.pick b{display:block;font-size:17px}.pick span{display:block;margin-top:8px;color:#9c968b;font-size:12px}.pick input{position:absolute;width:1px;height:1px;opacity:0}.preview{display:none;width:100%;max-height:48vh;margin:18px 0;border-radius:10px;object-fit:contain;background:#eee9df}.submit{width:100%;min-height:52px;border:0;border-radius:9px;background:#9f2925;color:white;font-size:16px}.submit:disabled{opacity:.5}.status{min-height:24px;margin-top:14px;text-align:center;font-size:13px}.seal{display:grid;width:42px;height:42px;margin:0 0 14px auto;place-items:center;border:1px solid #9f2925;color:#9f2925;font-family:serif}.done{text-align:center;padding:42px 8px}.done h2{font-family:serif;font-weight:500}</style></head><body><main class="page"><p class="eyebrow">CHUN'AN NO.3 MIDDLE SCHOOL</p><div class="card" id="formCard"><div class="seal">三中</div><h1>上传校友照片</h1><p>选择手机相册中的照片或直接拍摄。照片仅用于本次明信片制作，并按终端设置自动清理。</p><label class="pick"><div><b>选择照片</b><span>支持 JPG、PNG、WebP，最大 15MB</span></div><input id="file" type="file" accept="image/jpeg,image/png,image/webp" capture="environment"></label><img id="preview" class="preview" alt="照片预览"><button id="submit" class="submit" disabled>发送到制作终端</button><p class="status" id="status"></p></div><div class="card done" id="done" hidden><div class="seal">成</div><h2>照片已送达</h2><p>请回到制作终端继续编辑明信片，本页面可以关闭。</p></div></main><script>
  const token=${safeToken},file=document.getElementById('file'),preview=document.getElementById('preview'),submit=document.getElementById('submit'),status=document.getElementById('status');let dataUrl='';
  file.addEventListener('change',()=>{const selected=file.files&&file.files[0];status.textContent='';if(!selected)return;if(!/^image\\/(jpeg|png|webp)$/.test(selected.type)||selected.size>15*1024*1024){status.textContent='请选择 15MB 以内的 JPG、PNG 或 WebP 图片';submit.disabled=true;return}const reader=new FileReader();reader.onload=()=>{dataUrl=String(reader.result);preview.src=dataUrl;preview.style.display='block';submit.disabled=false};reader.readAsDataURL(selected)});
  submit.addEventListener('click',async()=>{if(!dataUrl)return;submit.disabled=true;status.textContent='正在发送…';try{const response=await fetch('/photo-upload/'+token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dataUrl})});const result=await response.json();if(!response.ok)throw new Error(result.message||'发送失败');document.getElementById('formCard').hidden=true;document.getElementById('done').hidden=false}catch(error){status.textContent=error.message||'发送失败，请重试';submit.disabled=false}});
  </script></body></html>`
}

async function createWindow(operator = false) {
  const devUrl = process.env.VITE_DEV_SERVER_URL
  const target = devUrl ? `${devUrl}${operator ? '#operator' : ''}` : path.join(__dirname, '..', 'dist', 'index.html')
  const win = new BrowserWindow({
    width: operator ? 1440 : 1920,
    height: operator ? 900 : 1080,
    minWidth: 1024,
    minHeight: 650,
    fullscreen: !operator,
    kiosk: !operator && !devUrl,
    autoHideMenuBar: true,
    backgroundColor: '#f6f3ec',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false },
  })
  if (devUrl) await win.loadURL(target)
  else {
    await win.loadFile(target)
    if (operator) await win.webContents.executeJavaScript(`location.hash = 'operator'`)
  }
  if (!operator) mainWindow = win
  return win
}

async function renderDataUrl(dataUrl) {
  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false } })
  const html = `<html><head><style>@page{size:148mm 105mm;margin:0}html,body{margin:0;width:148mm;height:105mm;overflow:hidden}img{display:block;width:148mm;height:105mm;object-fit:cover}</style></head><body><img src="${dataUrl}"></body></html>`
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  return win
}

function startPickupServer() {
  pickupServer = createServer(async (req, res) => {
    try {
      cleanExpiredPhotoUploads()
      const url = new URL(req.url || '/', 'http://localhost')
      const uploadMatch = url.pathname.match(/^\/photo-upload\/([a-f0-9]{32})$/)
      if (uploadMatch) {
        const upload = photoUploads.get(uploadMatch[1])
        if (!upload || upload.expiresAt <= Date.now()) {
          res.writeHead(410, { 'Content-Type': 'text/plain; charset=utf-8' })
          return res.end('上传二维码已过期，请在终端重新生成')
        }
        if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
          return res.end(mobileUploadPage(uploadMatch[1]))
        }
        if (req.method === 'POST') {
          const body = await readJsonBody(req)
          const dataUrl = String(body.dataUrl || '')
          const imageMatch = dataUrl.match(/^data:image\/(jpeg|png|webp);base64,([a-zA-Z0-9+/=\r\n]+)$/)
          if (!imageMatch || Buffer.byteLength(imageMatch[2], 'base64') > 15 * 1024 * 1024) throw new Error('请选择 15MB 以内的 JPG、PNG 或 WebP 图片')
          upload.dataUrl = dataUrl
          upload.receivedAt = Date.now()
          return res.end(JSON.stringify({ ok: true }))
        }
        res.writeHead(405, { Allow: 'GET, POST' })
        return res.end()
      }
      const match = url.pathname.match(/^\/download\/([a-zA-Z0-9-_]+)(?:\/(image|pdf))?$/)
      if (!match) { res.writeHead(404); return res.end('Not found') }
      const id = safeId(match[1])
      const dir = path.join(postcardRoot(), id)
      if (match[2] === 'image') {
        const data = await fs.readFile(path.join(dir, 'postcard.png'))
        res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Disposition': `attachment; filename="${id}.png"`, 'Cache-Control': 'private, max-age=3600' })
        return res.end(data)
      }
      if (match[2] === 'pdf') {
        const data = await fs.readFile(path.join(dir, 'postcard.pdf'))
        res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${id}.pdf"`, 'Cache-Control': 'private, max-age=3600' })
        return res.end(data)
      }
      const imageUrl = `/download/${id}/image`
      const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>领取校友明信片</title><style>body{margin:0;background:#f6f3ec;color:#30312d;font-family:system-ui;text-align:center}.card{max-width:760px;margin:6vh auto;padding:24px}h1{font-family:serif;font-weight:500}img{width:100%;border:1px solid #ddd6ca;box-shadow:0 16px 45px #493a261c}.btn{display:inline-block;margin:22px 6px;padding:14px 24px;border-radius:8px;background:#9f2925;color:white;text-decoration:none}</style><main class="card"><p>淳安第三中学 · 校友明信片</p><h1>这份校园记忆，已为你珍藏</h1><img src="${imageUrl}" alt="校友明信片"><a class="btn" href="${imageUrl}">保存高清图片</a><a class="btn" href="/download/${id}/pdf">下载 PDF</a><p>取件页面将在系统设定的保留期后自动失效</p></main>`
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(html)
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('明信片已过期或不存在')
    }
  })
  pickupServer.listen(pickupPort, '0.0.0.0')
}

ipcMain.handle('photo:create-upload', () => {
  cleanExpiredPhotoUploads()
  const token = randomBytes(16).toString('hex')
  photoUploads.set(token, { expiresAt: Date.now() + photoUploadTtl, dataUrl: '' })
  return { token, url: `${uploadBase()}/${token}`, expiresAt: new Date(Date.now() + photoUploadTtl).toISOString() }
})

ipcMain.handle('photo:poll-upload', (_event, token) => {
  cleanExpiredPhotoUploads()
  const safeToken = String(token || '')
  const upload = photoUploads.get(safeToken)
  if (!upload) return { status: 'expired' }
  if (!upload.dataUrl) return { status: 'pending' }
  photoUploads.delete(safeToken)
  return { status: 'ready', dataUrl: upload.dataUrl }
})

ipcMain.handle('photo:cancel-upload', (_event, token) => {
  photoUploads.delete(String(token || ''))
  return true
})

ipcMain.handle('postcard:save', async (_event, payload) => {
  const id = safeId(payload.draft.id)
  const dir = path.join(postcardRoot(), id)
  await fs.mkdir(dir, { recursive: true })
  const manifestDraft = {
    ...payload.draft,
    photoDataUrl: '',
    signature: payload.draft.signature ? { ...payload.draft.signature, imageUrl: '' } : null,
  }
  await Promise.all([
    fs.writeFile(path.join(dir, 'postcard.png'), dataUrlToBuffer(payload.pngDataUrl)),
    fs.writeFile(path.join(dir, 'postcard.jpg'), dataUrlToBuffer(payload.jpegDataUrl)),
    fs.writeFile(path.join(dir, 'thumbnail.jpg'), dataUrlToBuffer(payload.thumbnailDataUrl)),
    fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify({ ...manifestDraft, files: ['postcard.png', 'postcard.jpg', 'postcard.pdf', 'thumbnail.jpg'] }, null, 2), 'utf8'),
  ])
  const win = await renderDataUrl(payload.pngDataUrl)
  const pdf = await win.webContents.printToPDF({ printBackground: true, pageSize: { width: 148000, height: 105000 }, margins: { top: 0, bottom: 0, left: 0, right: 0 } })
  win.destroy()
  await fs.writeFile(path.join(dir, 'postcard.pdf'), pdf)
  return { ok: true, path: dir, pickupUrl: `${pickupBase()}/${id}` }
})

ipcMain.handle('postcard:export', async (_event, payload) => {
  const id = safeId(payload.id)
  const format = ['png', 'jpeg', 'pdf'].includes(payload.format) ? payload.format : 'png'
  const extension = format === 'jpeg' ? 'jpg' : format
  const result = await dialog.showSaveDialog(mainWindow, { defaultPath: `${id}.${extension}`, filters: [{ name: extension.toUpperCase(), extensions: [extension] }] })
  if (result.canceled || !result.filePath) return { ok: false, cancelled: true }
  if (format === 'pdf') await fs.copyFile(path.join(postcardRoot(), id, 'postcard.pdf'), result.filePath)
  else await fs.writeFile(result.filePath, dataUrlToBuffer(payload.dataUrl))
  return { ok: true, path: result.filePath }
})

ipcMain.handle('postcard:cache-image', async (_event, payload) => {
  const id = safeId(payload.draftId)
  const dir = path.join(postcardRoot(), id)
  const filePath = path.join(dir, 'postcard.png')
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(filePath, dataUrlToBuffer(payload.dataUrl))
  const manifestPath = path.join(dir, 'manifest.json')
  try {
    await fs.access(manifestPath)
  } catch {
    await fs.writeFile(manifestPath, JSON.stringify({
      id,
      createdAt: payload.createdAt || new Date().toISOString(),
      remotePrintCache: true,
      files: ['postcard.png'],
    }, null, 2), 'utf8')
  }
  return { ok: true, path: filePath }
})

ipcMain.handle('postcard:print', async (_event, payload) => {
  try {
    const id = safeId(payload.draftId)
    const filePath = path.join(postcardRoot(), id, 'postcard.png')
    await fs.access(filePath)
    await printImageFile(filePath, String(payload.printerName || ''), payload.copies)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '打印失败' }
  }
})

ipcMain.handle('printer:list', async (event) => {
  const printers = await event.sender.getPrintersAsync()
  return printers.map((printer) => {
    const options = printer.options && typeof printer.options === 'object' ? printer.options : {}
    const defaultOption = options['is-default'] ?? options.is_default ?? options.isDefault ?? options.default
    return {
      name: printer.displayName || printer.name,
      deviceName: printer.name,
      isDefault: Boolean(printer.isDefault) || ['1', 'true', 'yes', 'on'].includes(String(defaultOption || '').toLowerCase()),
    }
  })
})
ipcMain.handle('window:fullscreen', (event) => { BrowserWindow.fromWebContents(event.sender)?.setFullScreen(true); return true })
ipcMain.handle('window:operator', async () => { await createWindow(true); return true })
ipcMain.handle('window:close-operator', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win || win === mainWindow) return false
  win.close()
  return true
})

app.whenReady().then(async () => {
  await fs.mkdir(postcardRoot(), { recursive: true })
  await purgeExpiredPostcardFiles()
  setInterval(() => purgeExpiredPostcardFiles().catch(() => undefined), 60 * 60 * 1000).unref()
  startPickupServer()
  await createWindow(false)
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('before-quit', () => pickupServer?.close())
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(false) })
