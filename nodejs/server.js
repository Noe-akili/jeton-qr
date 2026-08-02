'use strict'

const http = require('http')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { channel, getDataPath } = require('bridge')

const PORT = Number(process.env.JETONQR_PORT) || 8123
const MAX_EVENTS = 2000

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
        name: 'jetonqr',
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
