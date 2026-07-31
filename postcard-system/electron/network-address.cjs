function isPrivateIpv4(address) {
  const parts = String(address || '').split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
  return parts[0] === 10
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
}

function isVirtualInterface(name, address) {
  const label = String(name || '').toLowerCase()
  if (/meta|tun|tap|vpn|loopback|vethernet|hyper-v|wsl|docker|vmware|virtualbox|default switch/.test(label)) return true
  if (/^198\.(1[89])\./.test(String(address || ''))) return true
  return false
}

function chooseLocalAddress(interfaces, configuredAddress = '') {
  const configured = String(configuredAddress || '').trim()
  if (configured) return configured

  const candidates = []
  for (const [name, addresses] of Object.entries(interfaces || {})) {
    for (const address of addresses || []) {
      if (address.family !== 'IPv4' || address.internal || !isPrivateIpv4(address.address)) continue
      const virtual = isVirtualInterface(name, address.address)
      const physicalName = /以太网|ethernet|wi-?fi|wlan|无线|local area connection/i.test(name)
      candidates.push({
        address: address.address,
        score: (virtual ? -100 : 0) + (physicalName ? 20 : 0) + (address.mac && address.mac !== '00:00:00:00:00:00' ? 5 : 0),
      })
    }
  }
  candidates.sort((left, right) => right.score - left.score)
  return candidates[0]?.address || '127.0.0.1'
}

module.exports = { chooseLocalAddress, isPrivateIpv4, isVirtualInterface }
