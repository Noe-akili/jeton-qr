import { ref } from 'vue'
import { storageGet, storageSet } from './useStorage'

const deviceName = ref(defaultDeviceName())
const serverEnabled = ref(false)
const port = ref(8123)
const peersRaw = ref('')

let loaded = false

function defaultDeviceName() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return `Appareil-${s}`
}

export async function loadConfig() {
  if (loaded) return
  loaded = true
  try {
    const [d, s, p, pe] = await Promise.all([
      storageGet('deviceName'),
      storageGet('serverEnabled'),
      storageGet('port'),
      storageGet('peers'),
    ])
    if (d) deviceName.value = d
    if (s === 'true') serverEnabled.value = true
    if (p) port.value = Number(p) || 8123
    if (pe) peersRaw.value = pe
  } catch (e) {}
}

export async function saveConfig() {
  try {
    await Promise.all([
      storageSet('deviceName', deviceName.value),
      storageSet('serverEnabled', String(serverEnabled.value)),
      storageSet('port', String(port.value)),
      storageSet('peers', peersRaw.value),
    ])
  } catch (e) {}
}

export function peersList() {
  return peersRaw.value
    .split(/\r?\n|,/)
    .map(s => s.trim().replace(/^https?:\/\//, '').replace(/\/$/, ''))
    .filter(Boolean)
}

export { deviceName, serverEnabled, port, peersRaw }

export function useConfig() {
  return { deviceName, serverEnabled, port, peersRaw, loadConfig, saveConfig, peersList }
}
