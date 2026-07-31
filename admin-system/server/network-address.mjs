function isIpv4(entry) {
  return entry?.family === 'IPv4' || entry?.family === 4
}

export function isPrivateIpv4(address) {
  const parts = String(address || '').split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
  return parts[0] === 10
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
}

function isVirtualInterface(name, address) {
  const value = `${name} ${address}`.toLowerCase()
  return /(?:^|\W)(meta|tun|tap|vpn|loopback|vethernet|hyper-v|wsl|docker|vmware|virtualbox)(?:\W|$)/i.test(value)
    || value.includes('default switch')
    || /^198\.(?:18|19)\./.test(String(address))
}

export function chooseLocalAddress(interfaces, configuredAddress = '') {
  const configured = String(configuredAddress || '').trim()
  if (configured) return configured

  const candidates = []
  for (const [name, addresses] of Object.entries(interfaces || {})) {
    for (const entry of addresses || []) {
      if (!isIpv4(entry) || entry.internal || !isPrivateIpv4(entry.address)) continue
      let score = 0
      if (/(以太网|ethernet|wi-?fi|wlan|无线|local area connection)/i.test(name)) score += 20
      if (entry.mac && entry.mac !== '00:00:00:00:00:00') score += 5
      if (isVirtualInterface(name, entry.address)) score -= 100
      candidates.push({ address: entry.address, score })
    }
  }

  candidates.sort((left, right) => right.score - left.score)
  return candidates[0]?.address || '127.0.0.1'
}

export function publicBaseUrl({ configuredBaseUrl = '', address, port }) {
  const configured = String(configuredBaseUrl || '').trim()
  return (configured || `http://${address}:${port}`).replace(/\/+$/, '')
}
