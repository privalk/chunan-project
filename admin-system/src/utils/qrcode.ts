// Compact offline QR encoder shared with the postcard terminal.
// Version 5-L stores up to 106 UTF-8 bytes and needs no external service.
const VERSION = 5
const SIZE = 17 + VERSION * 4
const DATA_CODEWORDS = 108
const ECC_CODEWORDS = 26

function gfMultiply(left: number, right: number) {
  let result = 0
  for (let bit = 7; bit >= 0; bit -= 1) {
    result = (result << 1) ^ ((result >>> 7) * 0x11d)
    result ^= ((right >>> bit) & 1) * left
  }
  return result
}

function reedSolomonGenerator(degree: number) {
  const result = new Uint8Array(degree)
  result[degree - 1] = 1
  let root = 1
  for (let index = 0; index < degree; index += 1) {
    for (let inner = 0; inner < result.length; inner += 1) {
      result[inner] = gfMultiply(result[inner], root)
      if (inner + 1 < result.length) result[inner] ^= result[inner + 1]
    }
    root = gfMultiply(root, 2)
  }
  return result
}

function reedSolomonRemainder(data: Uint8Array, divisor: Uint8Array) {
  const result = new Uint8Array(divisor.length)
  for (const value of data) {
    const factor = value ^ result[0]
    result.copyWithin(0, 1)
    result[result.length - 1] = 0
    for (let index = 0; index < result.length; index += 1) {
      result[index] ^= gfMultiply(divisor[index], factor)
    }
  }
  return result
}

function appendBits(target: number[], value: number, length: number) {
  for (let bit = length - 1; bit >= 0; bit -= 1) target.push((value >>> bit) & 1)
}

function createCodewords(text: string) {
  const bytes = new TextEncoder().encode(text)
  if (bytes.length > 106) throw new Error('取件地址过长，无法生成离线二维码')
  const bits: number[] = []
  appendBits(bits, 0b0100, 4)
  appendBits(bits, bytes.length, 8)
  for (const value of bytes) appendBits(bits, value, 8)
  appendBits(bits, 0, Math.min(4, DATA_CODEWORDS * 8 - bits.length))
  while (bits.length % 8) bits.push(0)
  const data: number[] = []
  for (let index = 0; index < bits.length; index += 8) {
    data.push(Number.parseInt(bits.slice(index, index + 8).join(''), 2))
  }
  for (let pad = 0; data.length < DATA_CODEWORDS; pad += 1) data.push(pad % 2 ? 0x11 : 0xec)
  const payload = Uint8Array.from(data)
  return Uint8Array.from([
    ...payload,
    ...reedSolomonRemainder(payload, reedSolomonGenerator(ECC_CODEWORDS)),
  ])
}

function drawFinder(modules: boolean[][], reserved: boolean[][], row: number, column: number) {
  for (let y = -1; y <= 7; y += 1) for (let x = -1; x <= 7; x += 1) {
    const targetRow = row + y
    const targetColumn = column + x
    if (targetRow < 0 || targetColumn < 0 || targetRow >= SIZE || targetColumn >= SIZE) continue
    const dark = x >= 0 && x <= 6 && y >= 0 && y <= 6
      && (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4))
    modules[targetRow][targetColumn] = dark
    reserved[targetRow][targetColumn] = true
  }
}

function drawAlignment(modules: boolean[][], reserved: boolean[][], row: number, column: number) {
  for (let y = -2; y <= 2; y += 1) for (let x = -2; x <= 2; x += 1) {
    modules[row + y][column + x] = Math.max(Math.abs(x), Math.abs(y)) !== 1
    reserved[row + y][column + x] = true
  }
}

function setFormat(modules: boolean[][], reserved: boolean[][]) {
  const format = 0x77c4
  const bit = (index: number) => Boolean((format >>> index) & 1)
  for (let index = 0; index <= 5; index += 1) {
    modules[index][8] = bit(index); reserved[index][8] = true
  }
  modules[7][8] = bit(6); reserved[7][8] = true
  modules[8][8] = bit(7); reserved[8][8] = true
  modules[8][7] = bit(8); reserved[8][7] = true
  for (let index = 9; index < 15; index += 1) {
    modules[8][14 - index] = bit(index); reserved[8][14 - index] = true
  }
  for (let index = 0; index < 8; index += 1) {
    modules[8][SIZE - 1 - index] = bit(index); reserved[8][SIZE - 1 - index] = true
  }
  for (let index = 8; index < 15; index += 1) {
    modules[SIZE - 15 + index][8] = bit(index); reserved[SIZE - 15 + index][8] = true
  }
  modules[SIZE - 8][8] = true; reserved[SIZE - 8][8] = true
}

function createMatrix(text: string) {
  const modules = Array.from({ length: SIZE }, () => Array(SIZE).fill(false) as boolean[])
  const reserved = Array.from({ length: SIZE }, () => Array(SIZE).fill(false) as boolean[])
  drawFinder(modules, reserved, 0, 0)
  drawFinder(modules, reserved, 0, SIZE - 7)
  drawFinder(modules, reserved, SIZE - 7, 0)
  for (let index = 8; index < SIZE - 8; index += 1) {
    modules[6][index] = index % 2 === 0; reserved[6][index] = true
    modules[index][6] = index % 2 === 0; reserved[index][6] = true
  }
  drawAlignment(modules, reserved, 30, 30)
  setFormat(modules, reserved)

  const bits: number[] = []
  for (const value of createCodewords(text)) appendBits(bits, value, 8)
  let bitIndex = 0
  let upward = true
  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1
    for (let offset = 0; offset < SIZE; offset += 1) {
      const row = upward ? SIZE - 1 - offset : offset
      for (let column = right; column >= right - 1; column -= 1) {
        if (reserved[row][column]) continue
        const value = bitIndex < bits.length ? Boolean(bits[bitIndex]) : false
        modules[row][column] = value !== ((row + column) % 2 === 0)
        bitIndex += 1
      }
    }
    upward = !upward
  }
  return modules
}

export function createQrDataUrl(text: string, width = 360) {
  const modules = createMatrix(text)
  const margin = 4
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = width
  const context = canvas.getContext('2d')
  if (!context) throw new Error('二维码画布不可用')
  context.fillStyle = '#fffefb'
  context.fillRect(0, 0, width, width)
  const scale = width / (SIZE + margin * 2)
  context.fillStyle = '#30312d'
  for (let row = 0; row < SIZE; row += 1) for (let column = 0; column < SIZE; column += 1) {
    if (modules[row][column]) {
      context.fillRect(
        Math.floor((column + margin) * scale),
        Math.floor((row + margin) * scale),
        Math.ceil(scale),
        Math.ceil(scale),
      )
    }
  }
  return canvas.toDataURL('image/png')
}
