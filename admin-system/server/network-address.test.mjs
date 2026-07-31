import test from 'node:test'
import assert from 'node:assert/strict'
import { chooseLocalAddress, isPrivateIpv4, publicBaseUrl } from './network-address.mjs'

test('后台领取地址优先使用真实局域网网卡', () => {
  const interfaces = {
    Meta: [{ address: '198.18.0.1', family: 'IPv4', internal: false, mac: '00:00:00:00:00:00' }],
    'vEthernet (Default Switch)': [{ address: '172.17.80.1', family: 'IPv4', internal: false, mac: '00:15:5d:01:02:03' }],
    以太网: [{ address: '192.168.5.247', family: 'IPv4', internal: false, mac: '08:bf:b8:75:48:5f' }],
  }
  assert.equal(chooseLocalAddress(interfaces), '192.168.5.247')
})

test('后台领取地址允许部署时显式覆盖', () => {
  assert.equal(chooseLocalAddress({}, '192.168.10.8'), '192.168.10.8')
  assert.equal(publicBaseUrl({ configuredBaseUrl: 'https://postcard.example.test/', address: '192.168.5.247', port: 8787 }), 'https://postcard.example.test')
})

test('后台只把 RFC1918 地址作为局域网候选', () => {
  assert.equal(isPrivateIpv4('10.0.0.8'), true)
  assert.equal(isPrivateIpv4('172.16.0.8'), true)
  assert.equal(isPrivateIpv4('192.168.5.247'), true)
  assert.equal(isPrivateIpv4('198.18.0.1'), false)
})
