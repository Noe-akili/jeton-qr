import { ref } from 'vue'
import { useToast } from './useToast'
import { detectType, playFeedback } from '../utils'
import { storageGet, storageSet } from './useStorage'
import { deviceName } from './useConfig'
import { emit, on } from './useBus'

const jetons = ref([])
const history = ref([])

let saveTimer = null
let loaded = false
const pendingRemoteEvents = []

function eventId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

async function load() {
  try {
    const [j, h] = await Promise.all([storageGet('jetons'), storageGet('history')])
    if (j) {
      jetons.value = JSON.parse(j)
      migrate(jetons.value)
    }
    if (h) {
      history.value = JSON.parse(h)
      migrateHistory(history.value)
    }
  } catch (e) {}
  loaded = true
  if (pendingRemoteEvents.length) {
    const list = pendingRemoteEvents.splice(0)
    mergeRemoteEvents(list)
  }
  emit('storeLoaded')
}

function migrate(list) {
  let changed = false
  list.forEach(j => {
    if (!('status' in j)) { j.status = 'disponible'; changed = true }
    if (!('clientNom' in j)) { j.clientNom = ''; changed = true }
    if (!('sortieAt' in j)) { j.sortieAt = null; changed = true }
    if (!('entreeAt' in j)) { j.entreeAt = null; changed = true }
    if (!('sortieCount' in j)) { j.sortieCount = 0; changed = true }
    if (!('updatedAt' in j)) { j.updatedAt = j.sortieAt || j.entreeAt || Date.now(); changed = true }
  })
  if (changed) save()
}

function migrateHistory(list) {
  let changed = false
  list.forEach(h => {
    if (!('eventId' in h)) { h.eventId = eventId(); changed = true }
    if (!('device' in h)) { h.device = h.device || h.remote ? (h.remote || '') : ''; changed = true }
    if (!('date' in h)) { h.date = Date.now(); changed = true }
  })
  if (changed) save()
}

async function write() {
  try {
    await Promise.all([
      storageSet('jetons', JSON.stringify(jetons.value)),
      storageSet('history', JSON.stringify(history.value)),
    ])
  } catch (e) {}
  emit('localState', { jetons: jetons.value.slice(), history: history.value.slice() })
}

function save() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(write, 250)
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      write()
    }
  })
}

function newJeton(numero, id, type, nom) {
  return {
    numero,
    id,
    type: type || 'Inconnu',
    nom: nom || '',
    status: 'disponible',
    clientNom: '',
    sortieAt: null,
    entreeAt: null,
    sortieCount: 0,
    updatedAt: Date.now(),
  }
}

function pushMouvement(jetonId, mouvement, clientNom) {
  const jeton = jetons.value.find(j => j.id === jetonId)
  const item = {
    eventId: eventId(),
    data: jetonId,
    label: jeton ? `JETON N° ${jeton.numero}` : jetonId,
    jetonId,
    mouvement,
    clientNom: clientNom || '',
    type: jeton ? (jeton.type || 'JETON') : detectType(jetonId),
    timestamp: new Date().toLocaleString(),
    date: Date.now(),
    device: deviceName.value,
  }
  history.value.unshift(item)
  if (history.value.length > 1000) history.value.pop()
  emit('localEvent', item)
  return item
}

function addJeton(id, type, nom) {
  const toast = useToast()
  if (jetons.value.some(j => j.id === id)) {
    toast.info('Ce jeton existe déjà')
    return false
  }
  jetons.value.push(newJeton(jetons.value.length + 1, id, type, nom))
  save()
  toast.success('Jeton enregistré ✅')
  return true
}

function updateJeton(id, type, nom) {
  const toast = useToast()
  const jeton = jetons.value.find(j => j.id === id)
  if (!jeton) return
  jeton.type = type
  jeton.nom = nom
  jeton.updatedAt = Date.now()
  save()
  toast.success('Jeton modifié')
}

function generateJetons(count, type, nom) {
  const toast = useToast()
  if (!count || count < 1) { toast.error('Nombre invalide'); return 0 }
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let added = 0
  for (let i = 0; i < count; i++) {
    let id
    do {
      id = 'JTON-' + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    } while (jetons.value.some(j => j.id === id))
    jetons.value.push(newJeton(jetons.value.length + 1, id, type, nom))
    added++
  }
  save()
  toast.success(`${added} jetons générés`)
  return added
}

function sortirJeton(id, clientNom) {
  const toast = useToast()
  const jeton = jetons.value.find(j => j.id === id)
  if (!jeton) return false
  if (jeton.status === 'sorti') {
    toast.info('Ce jeton est déjà chez un client')
    return false
  }
  jeton.status = 'sorti'
  jeton.clientNom = clientNom || ''
  jeton.sortieAt = Date.now()
  jeton.entreeAt = null
  jeton.updatedAt = Date.now()
  jeton.sortieCount = (jeton.sortieCount || 0) + 1
  pushMouvement(jeton.id, 'sortie', jeton.clientNom)
  save()
  playFeedback()
  return true
}

function rentrerJeton(id) {
  const toast = useToast()
  const jeton = jetons.value.find(j => j.id === id)
  if (!jeton) return null
  if (jeton.status !== 'sorti') {
    toast.info('Ce jeton n\'est pas sorti')
    return null
  }
  const now = Date.now()
  const duree = now - (jeton.sortieAt || now)
  jeton.entreeAt = now
  jeton.status = 'disponible'
  jeton.updatedAt = now
  pushMouvement(jeton.id, 'entree', jeton.clientNom)
  jeton.clientNom = ''
  save()
  playFeedback()
  return { duree }
}

function rentrerTousJetons() {
  const toast = useToast()
  const sortis = jetons.value.filter(j => j.status === 'sorti')
  if (sortis.length === 0) {
    toast.info('Aucun jeton chez un client')
    return 0
  }
  if (!confirm(`Rentrer les ${sortis.length} jeton(s) actuellement chez les clients ?`)) return 0
  const now = Date.now()
  sortis.forEach(j => {
    j.entreeAt = now
    j.status = 'disponible'
    j.updatedAt = now
    pushMouvement(j.id, 'entree', j.clientNom)
    j.clientNom = ''
  })
  save()
  playFeedback()
  toast.success(`${sortis.length} jeton(s) rentré(s)`)
  return sortis.length
}

function deleteJeton(id) {
  const toast = useToast()
  const jeton = jetons.value.find(j => j.id === id)
  if (!jeton) return
  if (jeton.status === 'sorti') {
    toast.error('Jeton actuellement chez un client — rentrez-le d\'abord')
    return
  }
  if (!confirm(`Supprimer le jeton N° ${jeton.numero} ?`)) return
  jetons.value = jetons.value.filter(j => j.id !== id)
  jetons.value.forEach((j, idx) => { j.numero = idx + 1 })
  save()
  toast.info('Jeton supprimé')
}

function clearAllJetons() {
  const toast = useToast()
  if (jetons.value.length === 0) return
  if (!confirm('Supprimer tous les jetons ?')) return
  jetons.value = []
  save()
  toast.info('Tous les jetons supprimés')
}

function addHistory(data) {
  const jeton = jetons.value.find(j => j.id === data)
  const item = {
    eventId: eventId(),
    data,
    label: jeton ? `JETON N° ${jeton.numero}` : data,
    jetonId: jeton ? jeton.id : null,
    mouvement: undefined,
    clientNom: jeton ? jeton.clientNom : '',
    type: jeton ? (jeton.type || 'JETON') : detectType(data),
    timestamp: new Date().toLocaleString(),
    date: Date.now(),
    device: deviceName.value,
  }
  history.value.unshift(item)
  if (history.value.length > 1000) history.value.pop()
  emit('localEvent', item)
  save()
  playFeedback()
}

function deleteHistoryItem(index) {
  const toast = useToast()
  history.value.splice(index, 1)
  save()
  toast.info('Élément supprimé')
}

function clearHistory() {
  const toast = useToast()
  if (history.value.length === 0) return
  if (!confirm('Effacer tout l\'historique ?')) return
  history.value = []
  save()
  toast.info('Historique effacé')
}

function resetAll() {
  const toast = useToast()
  if (!confirm('Toutes les données seront définitivement supprimées. Continuer ?')) return
  jetons.value = []
  history.value = []
  save()
  toast.info('Données réinitialisées')
}

function sortHistory() {
  history.value.sort((a, b) => (b.date || 0) - (a.date || 0))
}

function mergeRemoteEvents(events) {
  if (!Array.isArray(events) || events.length === 0) return 0
  if (!loaded) {
    pendingRemoteEvents.push(...events)
    return 0
  }
  const known = new Set(history.value.map(h => h.eventId))
  let added = 0
  events.forEach(e => {
    if (!e || !e.eventId || known.has(e.eventId)) return
    known.add(e.eventId)
    history.value.unshift({ ...e, remote: true })
    added++
  })
  if (added > 0) {
    sortHistory()
    if (history.value.length > 1000) history.value.length = 1000
    save()
  }
  return added
}

function mergeRemoteJetons(list) {
  if (!Array.isArray(list) || list.length === 0) return 0
  if (!loaded) return 0
  const byId = new Map(jetons.value.map(j => [j.id, j]))
  let changed = false
  list.forEach(j => {
    if (!j || !j.id) return
    const cur = byId.get(j.id)
    if (!cur) {
      byId.set(j.id, { ...newJeton(0, j.id, j.type, j.nom), ...j })
      changed = true
      return
    }
    const curTs = Math.max(cur.sortieAt || 0, cur.entreeAt || 0, cur.updatedAt || 0)
    const newTs = Math.max(j.sortieAt || 0, j.entreeAt || 0, j.updatedAt || 0)
    if (newTs > curTs) {
      byId.set(j.id, { ...j })
      changed = true
    }
  })
  if (changed) {
    jetons.value = [...byId.values()]
    jetons.value.forEach((j, idx) => { j.numero = idx + 1 })
    save()
  }
  return changed ? 1 : 0
}

on('remoteEvents', (events) => {
  mergeRemoteEvents(events)
})

on('remoteJetons', (list) => {
  mergeRemoteJetons(list)
})

export function useJetonStore() {
  return {
    jetons,
    history,
    load,
    save,
    addJeton,
    updateJeton,
    generateJetons,
    sortirJeton,
    rentrerJeton,
    rentrerTousJetons,
    deleteJeton,
    clearAllJetons,
    addHistory,
    deleteHistoryItem,
    clearHistory,
    resetAll,
    mergeRemoteEvents,
    mergeRemoteJetons,
  }
}
