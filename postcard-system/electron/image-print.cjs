const { execFile } = require('node:child_process')
const path = require('node:path')

function imagePrintCommand(filePath, printerName, windowsDirectory = process.env.WINDIR || 'C:\\Windows') {
  return {
    executable: path.join(windowsDirectory, 'System32', 'rundll32.exe'),
    args: [
      path.join(windowsDirectory, 'System32', 'shimgvw.dll') + ',ImageView_PrintTo',
      '/pt',
      filePath,
      printerName,
    ],
  }
}

function runImagePrintCommand(filePath, printerName) {
  const command = imagePrintCommand(filePath, printerName)
  return new Promise((resolve, reject) => {
    execFile(command.executable, command.args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        const detail = String(stderr || error.message || '').trim()
        reject(new Error(`打印失败${detail ? `：${detail}` : ''}`))
        return
      }
      resolve(stdout)
    })
  })
}

// Send one ImageView_PrintTo command per copy. This mirrors the Windows print
// behavior requested for the terminal and avoids Electron's HTML print pipeline.
async function printImageFile(filePath, printerName, copies, runner = runImagePrintCommand) {
  const count = Math.max(1, Math.min(10, Number(copies || 1)))
  if (!String(filePath || '').trim()) throw new Error('缺少待打印图片文件')
  if (!String(printerName || '').trim()) throw new Error('请先在运维台选择打印机')
  for (let index = 0; index < count; index += 1) {
    await runner(filePath, printerName)
  }
}

module.exports = { imagePrintCommand, printImageFile, runImagePrintCommand }
