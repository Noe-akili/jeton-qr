import { ref } from 'vue'
import { NodeJS } from '@choreruiz/capacitor-node-js'
import { useJetonStore } from './useJetonStore'
import { useConfig } from './useConfig'
import { on } from './useBus'

const isCapacitor = typeof window !== 'undefined' && 'Capacitor' in window

const status = ref({
  nodeRunning: false,
  ip: '',
  port: 8123,
  syncOn: true,
  lastSync: 0,
  lastError: '',
  peersOk: 0,
  peersTotal: 0,
})

const discoveredPeers = ref([])
const discoveryOn = ref(false)

let nodeReady = false
let nodeStarted = false
let pollTimer = null
let discoveryTimer = null

function waitNodeReady(timeout) {
  return new Promise(resolve => {
    const start = Date.now()
    const t = setInterval(() => {
      if (nodeReady) {
        clearInterval(t)
        resolve(true)
      } else if (Date.now() - start > timeout) {
        clearInterval(t)
        resolve(false)
      }
    }, 200)
  })
}

function pushStateToServer() {
  if (!nodeReady) return
  const { jetons, history } = useJetonStore()
  NodeJS.send({ eventName: 'pushState', args: [{ jetons: jetons.value, history: history.value }] }).catch(() => {})
}

function pushEventToOwnServer(event) {
  if (!nodeReady) return
  NodeJS.send({ eventName: 'pushEvent', args: [{ event }] }).catch(() => {})
}

function pushEventToPeers(event) {
  const cfg = useConfig()
  if (!cfg.serverEnabled.value) return
  const peers = cfg.peersList()
  if (!peers.length) return
  peers.forEach(addr => {
    fetch('http://' + addr + '/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [event] }),
    }).catch(() => {})
  })
}

function pushEvent(event) {
  if (!event) return
  pushEventToOwnServer(event)
  pushEventToPeers(event)
}

async function pullAll() {
  const cfg = useConfig()
  if (!cfg.serverEnabled.value) return
  const store = useJetonStore()
  const targets = []
  if (nodeReady && status.value.port) targets.push('127.0.0.1:' + status.value.port)
  cfg.peersList().forEach(p => targets.push(p))
  if (!targets.length) return

  let ok = 0
  for (const t of targets) {
    try {
      const r = await fetch('http://' + t + '/api/events')
      const d = await r.json()
      if (d && Array.isArray(d.events) && d.events.length) {
        store.mergeRemoteEvents(d.events)
      }
      const r2 = await fetch('http://' + t + '/api/jetons')
      const d2 = await r2.json()
      if (d2 && Array.isArray(d2.jetons)) {
        store.mergeRemoteJetons(d2.jetons)
      }
      ok++
    } catch (e) {
      status.value.lastError = 'Connexion impossible : ' + t
    }
  }
  status.value.peersOk = ok
  status.value.peersTotal = targets.length
  status.value.lastSync = Date.now()
  if (ok > 0 && ok === targets.length) status.value.lastError = ''
}

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(() => pullAll(), 15000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function discoverNow() {
  if (!nodeReady) return
  NodeJS.send({ eventName: 'discoverNow' }).catch(() => {})
}

function setDiscoveryOn(v) {
  discoveryOn.value = !!v
  if (discoveryOn.value) {
    discoverNow()
    if (!discoveryTimer) discoveryTimer = setInterval(() => discoverNow(), 5000)
  } else if (discoveryTimer) {
    clearInterval(discoveryTimer)
    discoveryTimer = null
  }
}

function handlePeerList(d) {
  const msg = (d.args && d.args[0]) || {}
  if (Array.isArray(msg.peers)) discoveredPeers.value = msg.peers
}

async function startNode() {
  if (!isCapacitor || nodeStarted) return
  nodeStarted = true
  const cfg = useConfig()
  try {
    NodeJS.addListener('serverReady', d => {
      const msg = (d.args && d.args[0]) || {}
      status.value.nodeRunning = true
      status.value.ip = msg.ip || ''
      status.value.port = msg.port || cfg.port.value
      nodeReady = true
      pushStateToServer()
    })
    NodeJS.addListener('serverError', d => {
      const msg = (d.args && d.args[0]) || {}
      status.value.lastError = msg.message || 'Erreur du serveur local'
    })
    NodeJS.addListener('remoteEvents', d => {
      const msg = (d.args && d.args[0]) || {}
      if (msg.events && msg.events.length) useJetonStore().mergeRemoteEvents(msg.events)
    })
    NodeJS.addListener('remoteJetons', d => {
      const msg = (d.args && d.args[0]) || {}
      if (msg.jetons) useJetonStore().mergeRemoteJetons(msg.jetons)
    })
    NodeJS.addListener('peerList', handlePeerList)
    await NodeJS.start({ env: { JETONQR_PORT: String(cfg.port.value), JETONQR_NAME: cfg.deviceName.value } })
    const ready = await waitNodeReady(8000)
    if (!ready && !status.value.nodeRunning) {
      status.value.lastError = 'Serveur local non démarré (délai dépassé)'
    }
  } catch (e) {
    status.value.lastError = 'Démarrage serveur : ' + (e && e.message ? e.message : String(e))
  }
}

function initSync() {
  const cfg = useConfig()
  status.value.syncOn = cfg.serverEnabled.value
  startNode()
  if (cfg.serverEnabled.value) startPolling()
  setTimeout(() => pullAll(), 2500)
}

function setSyncEnabled(v) {
  const cfg = useConfig()
  cfg.serverEnabled.value = v
  cfg.saveConfig()
  status.value.syncOn = v
  if (v) {
    startPolling()
    pullAll()
  } else {
    stopPolling()
  }
}

function syncNow() {
  if (!useConfig().serverEnabled.value) return Promise.reject(new Error('Synchronisation désactivée'))
  return pullAll()
}

on('localEvent', (e) => pushEvent(e))
on('localState', () => pushStateToServer())
on('storeLoaded', () => {
  setTimeout(() => pullAll(), 1500)
})

export function useSync() {
  return {
    status,
    discoveredPeers,
    discoveryOn,
    initSync,
    syncNow,
    setSyncEnabled,
    discoverNow,
    setDiscoveryOn,
    pushStateToServer,
  }
}
