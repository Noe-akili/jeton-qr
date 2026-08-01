import { ref } from 'vue'
import { useToast } from './useToast'
import { detectType, playFeedback } from '../utils'

const jetons = ref([])
const history = ref([])

let saveTimer = null

function load() {
  try {
    const j = localStorage.getItem('jetons')
    if (j) {
      jetons.value = JSON.parse(j)
      migrate(jetons.value)
    }
    const h = localStorage.getItem('history')
    if (h) history.value = JSON.parse(h)
  } catch (e) {}
}

function migrate(list) {
  let changed = false
  list.forEach(j => {
    if (!('status' in j)) { j.status = 'disponible'; changed = true }
    if (!('clientNom' in j)) { j.clientNom = ''; changed = true }
    if (!('sortieAt' in j)) { j.sortieAt = null; changed = true }
    if (!('entreeAt' in j)) { j.entreeAt = null; changed = true }
    if (!('sortieCount' in j)) { j.sortieCount = 0; changed = true }
  })
  if (changed) save()
}

function write() {
  try {
    localStorage.setItem('jetons', JSON.stringify(jetons.value))
    localStorage.setItem('history', JSON.stringify(history.value))
  } catch (e) {}
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
  }
}

function pushMouvement(jetonId, mouvement, clientNom) {
  const jeton = jetons.value.find(j => j.id === jetonId)
  history.value.unshift({
    data: jetonId,
    label: jeton ? `JETON N° ${jeton.numero}` : jetonId,
    jetonId,
    mouvement,
    clientNom: clientNom || '',
    type: jeton ? (jeton.type || 'JETON') : detectType(jetonId),
    timestamp: new Date().toLocaleString(),
    date: Date.now(),
  })
  if (history.value.length > 300) history.value.pop()
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
  pushMouvement(jeton.id, 'entree', jeton.clientNom)
  jeton.clientNom = ''
  save()
  playFeedback()
  return { duree }
}

function deleteJeton(id) {
  const toast = useToast()
  if (!confirm('Supprimer ce jeton ?')) return
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
  history.value.unshift({
    data,
    label: jeton ? `JETON N° ${jeton.numero}` : data,
    jetonId: jeton ? jeton.id : null,
    mouvement: undefined,
    clientNom: jeton ? jeton.clientNom : '',
    type: jeton ? (jeton.type || 'JETON') : detectType(data),
    timestamp: new Date().toLocaleString(),
    date: Date.now(),
  })
  if (history.value.length > 300) history.value.pop()
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
    deleteJeton,
    clearAllJetons,
    addHistory,
    deleteHistoryItem,
    clearHistory,
    resetAll,
  }
}
