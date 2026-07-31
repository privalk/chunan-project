const test = require('node:test')
const assert = require('node:assert/strict')
const { imagePrintCommand, printImageFile } = require('./image-print.cjs')

test('ImageView_PrintTo 使用参数化的 rundll32 命令', () => {
  const command = imagePrintCommand('C:\\Postcards\\a b.png', 'A6 彩色打印机', 'C:\\Windows')
  assert.equal(command.executable, 'C:\\Windows\\System32\\rundll32.exe')
  assert.deepEqual(command.args, [
    'C:\\Windows\\System32\\shimgvw.dll,ImageView_PrintTo',
    '/pt',
    'C:\\Postcards\\a b.png',
    'A6 彩色打印机',
  ])
})

test('每一份分别发送一次打印命令', async () => {
  const calls = []
  await printImageFile('C:\\Postcards\\postcard.png', 'Printer A', 3, async (...args) => {
    calls.push(args)
  })
  assert.deepEqual(calls, [
    ['C:\\Postcards\\postcard.png', 'Printer A'],
    ['C:\\Postcards\\postcard.png', 'Printer A'],
    ['C:\\Postcards\\postcard.png', 'Printer A'],
  ])
})

test('未选择打印机时拒绝打印', async () => {
  await assert.rejects(() => printImageFile('C:\\Postcards\\postcard.png', '', 1), /选择打印机/)
})
