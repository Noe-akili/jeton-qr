'use strict'

const http = require('http')
const fs = require('fs')
const path = require('path')
const os = require('os')
const dgram = require('dgram')
const { channel, getDataPath } = require('bridge')

const PORT = Number(process.env.JETONQR_PORT) || 8123
const MAX_EVENTS = 2000

const DEVICE_NAME = process.env.JETONQR_NAME || 'Appareil'
const DISCOVERY_PORT = Number(process.env.JETONQR_DISCOVERY_PORT) || 8591
const DISCOVERY_GROUP = '239.255.0.42'
const DISCOVERY_QUERY = 'JETONQR_DISCOVER'
const DISCOVERY_INTERVAL = 4000
const PEER_TIMEOUT = 20000

const state = { jetons: [], events: [] }

function dataDir() {
  try {
    return getDataPath()
  } catch (e) {}
  return process.cwd()
}

const dataFile = path.join(dataDir(), 'jetonqr-server-data.json')

function loadData() {
  try {
    const d = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
    if (d) {
      if (Array.isArray(d.jetons)) state.jetons = d.jetons
      if (Array.isArray(d.events)) state.events = d.events
    }
  } catch (e) {}
}

function saveData() {
  try {
    fs.writeFileSync(dataFile, JSON.stringify({ jetons: state.jetons, events: state.events }))
  } catch (e) {}
}

function lanIP() {
  try {
    const nets = os.networkInterfaces()
    for (const name of Object.keys(nets)) {
      for (const n of nets[name] || []) {
        if ((n.family === 'IPv4' || n.family === 4) && !n.internal) return n.address
      }
    }
  } catch (e) {}
  return '127.0.0.1'
}

function lanIPs() {
  const out = []
  try {
    const nets = os.networkInterfaces()
    for (const name of Object.keys(nets)) {
      for (const n of nets[name] || []) {
        if ((n.family === 'IPv4' || n.family === 4) && !n.internal) out.push(n.address)
      }
    }
  } catch (e) {}
  return out
}

function broadcastAddrs() {
  const out = new Set(['255.255.255.255'])
  try {
    const nets = os.networkInterfaces()
    for (const name of Object.keys(nets)) {
      for (const n of nets[name] || []) {
        if ((n.family === 'IPv4' || n.family === 4) && n.broadcast) out.add(n.broadcast)
      }
    }
  } catch (e) {}
  return [...out]
}

const seenPeers = new Map()

function peerSelf() {
  return { app: 'jetonqr', name: DEVICE_NAME, ip: lanIPs()[0] || '127.0.0.1', port: PORT }
}

function recordPeer(data) {
  if (!data || data.app !== 'jetonqr') return false
  const ip = String(data.ip || '')
  const port = Number(data.port) || PORT
  if (!ip) return false
  const selfIPs = lanIPs()
  if (port === PORT && selfIPs.indexOf(ip) !== -1) return false
  const key = ip + ':' + port
  const now = Date.now()
  const prev = seenPeers.get(key)
  seenPeers.set(key, { name: String(data.name || 'Appareil').slice(0, 40), ip, port, lastSeen: now })
  return !prev
}

function peerList() {
  const now = Date.now()
  for (const key of seenPeers.keys()) {
    if (now - seenPeers.get(key).lastSeen > PEER_TIMEOUT) seenPeers.delete(key)
  }
  return [...seenPeers.values()]
    .map(p => ({ name: p.name, ip: p.ip, port: p.port, lastSeen: p.lastSeen }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function emitPeers() {
  try { channel.send('peerList', { peers: peerList() }) } catch (e) {}
}

function startDiscovery() {
  let udp
  try {
    udp = dgram.createSocket({ type: 'udp4', reuseAddr: true })
  } catch (e) {
    return null
  }

  udp.on('error', () => {})

  udp.on('message', (msg, rinfo) => {
    try {
      const text = msg.toString().trim()
      if (text === DISCOVERY_QUERY) {
        const payload = Buffer.from(JSON.stringify({ type: 'peer', ...peerSelf() }))
        try { udp.send(payload, rinfo.port, rinfo.address) } catch (e) {}
        return
      }
      const data = JSON.parse(text)
      if (data && data.type === 'peer') {
        if (recordPeer(data)) emitPeers()
      }
    } catch (e) {}
  })

  const announce = () => {
    const payload = Buffer.from(JSON.stringify({ type: 'peer', ...peerSelf() }))
    broadcastAddrs().forEach(addr => {
      try { udp.send(payload, DISCOVERY_PORT, addr) } catch (e) {}
    })
    try { udp.send(payload, DISCOVERY_PORT, DISCOVERY_GROUP) } catch (e) {}
  }

  udp.bind(DISCOVERY_PORT, () => {
    try { udp.setBroadcast(true) } catch (e) {}
    try { udp.addMembership(DISCOVERY_GROUP) } catch (e) {}
    announce()
  })

  setInterval(announce, DISCOVERY_INTERVAL)
  setInterval(() => { if (seenPeers.size) emitPeers() }, 5000)

  channel.addListener('discoverNow', () => {
    const q = Buffer.from(DISCOVERY_QUERY)
    broadcastAddrs().forEach(addr => {
      try { udp.send(q, DISCOVERY_PORT, addr) } catch (e) {}
    })
    announce()
    emitPeers()
  })

  return udp
}

function mergeEvents(list) {
  const seen = new Set(state.events.map(e => e.eventId))
  const added = []
  ;(list || []).forEach(e => {
    if (!e || !e.eventId || seen.has(e.eventId)) return
    seen.add(e.eventId)
    state.events.unshift(e)
    added.push(e)
  })
  if (state.events.length > MAX_EVENTS) state.events.length = MAX_EVENTS
  return added
}

function mergeJetons(list) {
  const byId = new Map(state.jetons.map(j => [j.id, j]))
  let changed = false
  ;(list || []).forEach(j => {
    if (!j || !j.id) return
    const cur = byId.get(j.id)
    if (!cur) {
      byId.set(j.id, j)
      changed = true
      return
    }
    const curTs = Math.max(cur.sortieAt || 0, cur.entreeAt || 0, cur.updatedAt || 0)
    const newTs = Math.max(j.sortieAt || 0, j.entreeAt || 0, j.updatedAt || 0)
    if (newTs > curTs) {
      byId.set(j.id, j)
      changed = true
    }
  })
  if (changed) state.jetons = [...byId.values()]
  return changed
}

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', c => {
      body += c
      if (body.length > 5e6) {
        reject(new Error('body too large'))
        req.destroy()
      }
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

async function handleRequest(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' })
    res.end()
    return
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const p = url.pathname

  try {
    if (req.method === 'GET' && p === '/api/status') {
      sendJSON(res, 200, {
        ok: true,
        name: DEVICE_NAME,
        ip: lanIP(),
        port: PORT,
        eventCount: state.events.length,
        jetonCount: state.jetons.length,
        uptime: Math.round(process.uptime()),
      })
      return
    }

    if (req.method === 'GET' && p === '/api/events') {
      const since = Number(url.searchParams.get('since')) || 0
      const events = state.events.filter(e => (e.date || 0) > since)
      sendJSON(res, 200, { events })
      return
    }

    if (req.method === 'POST' && p === '/api/events') {
      const body = await readBody(req)
      let payload
      try { payload = JSON.parse(body || '{}') } catch (e) { sendJSON(res, 400, { ok: false, error: 'invalid json' }); return }
      const added = mergeEvents(payload.events)
      if (added.length) saveData()
      if (added.length) {
        try { channel.send('remoteEvents', { events: added }) } catch (e) {}
      }
      sendJSON(res, 200, { ok: true, added: added.length })
      return
    }

    if (req.method === 'GET' && p === '/api/jetons') {
      sendJSON(res, 200, { jetons: state.jetons })
      return
    }

    if (req.method === 'POST' && p === '/api/jetons') {
      const body = await readBody(req)
      let payload
      try { payload = JSON.parse(body || '{}') } catch (e) { sendJSON(res, 400, { ok: false, error: 'invalid json' }); return }
      const changed = mergeJetons(payload.jetons)
      if (changed) {
        saveData()
        try { channel.send('remoteJetons', { jetons: state.jetons }) } catch (e) {}
      }
      sendJSON(res, 200, { ok: true, changed: changed })
      return
    }

    if (p === '/') {
      sendJSON(res, 200, {
        ok: true,
        name: 'jetonqr-server',
        version: '1.0.0',
        endpoints: ['/api/status', '/api/events', '/api/jetons'],
      })
      return
    }

    sendJSON(res, 404, { ok: false, error: 'not found' })
  } catch (e) {
    sendJSON(res, 500, { ok: false, error: String(e.message || e) })
  }
}

channel.addListener('pushState', (payload) => {
  payload = payload || {}
  mergeEvents(payload.history)
  mergeJetons(payload.jetons)
  saveData()
})

channel.addListener('pushEvent', (payload) => {
  payload = payload || {}
  const added = mergeEvents([payload.event])
  if (added.length) saveData()
})

loadData()
startDiscovery()

const server = http.createServer(handleRequest)
server.on('error', (err) => {
  try { channel.send('serverError', { message: String(err.message || err) }) } catch (e) {}
})

server.listen(PORT, '0.0.0.0', () => {
  const ip = lanIP()
  try {
    channel.send('serverReady', { ip, port: PORT })
  } catch (e) {}
})
