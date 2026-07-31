const test = require('node:test')
const assert = require('node:assert/strict')
const { chooseLocalAddress, isPrivateIpv4 } = require('./network-address.cjs')

test('优先选择真实局域网网卡而不是 Meta 和 Hyper-V 地址', () => {
  const interfaces = {
    Meta: [{ family: 'IPv4', address: '198.18.0.1', internal: false, mac: '00:00:00:00:00:00' }],
    以太网: [{ family: 'IPv4', address: '192.168.5.247', internal: false, mac: '08:bf:b8:75:48:5f' }],
    'vEthernet (Default Switch)': [{ family: 'IPv4', address: '172.17.80.1', internal: false, mac: '00:15:5d:14:66:87' }],
  }
  assert.equal(chooseLocalAddress(interfaces), '192.168.5.247')
})

test('允许部署时显式指定取件服务地址', () => {
  assert.equal(chooseLocalAddress({}, '192.168.10.20'), '192.168.10.20')
})

test('只把 RFC1918 地址作为局域网候选', () => {
  assert.equal(isPrivateIpv4('192.168.1.2'), true)
  assert.equal(isPrivateIpv4('172.31.2.3'), true)
  assert.equal(isPrivateIpv4('10.2.3.4'), true)
  assert.equal(isPrivateIpv4('198.18.0.1'), false)
})
