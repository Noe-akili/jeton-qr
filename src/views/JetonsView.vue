<template>
  <div class="view">
    <div class="page-header">
      <h1><i class="fas fa-database"></i> Jetons</h1>
      <span class="badge">{{ availableCount }} · {{ outsCount }} sortis</span>
    </div>
    <div class="card">
      <div class="filter-bar">
        <input type="text" v-model="searchInput" @input="onSearch" placeholder="🔍 Rechercher...">
        <select v-model="typeFilter">
          <option value="">Tous types</option>
          <option v-for="t in availableTypes" :key="t" :value="t">{{ t }}</option>
        </select>
        <select v-model="statusFilter">
          <option value="">Tous statuts</option>
          <option value="disponible">Au comptoir</option>
          <option value="sorti">Chez client</option>
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th style="width:36px;"><input type="checkbox" :checked="allSelected" @change="toggleSelectAll"></th><th>N°</th><th>Appareil</th><th>Nom</th><th>Statut</th><th style="text-align:center;">Actions</th></tr></thead>
          <tbody>
            <tr v-if="filtered.length === 0" class="empty-row">
              <td colspan="6">Aucun jeton</td>
            </tr>
            <tr v-for="j in visibleJetons" :key="j.id" v-memo="[j.status, j.clientNom, j.sortieAt, j.type, j.nom, selectedIds.has(j.id)]">
              <td style="text-align:center;"><input type="checkbox" :checked="selectedIds.has(j.id)" @change="toggleSelect(j.id)"></td>
              <td>{{ j.numero }}</td>
              <td>{{ j.type || '—' }}</td>
              <td>{{ j.nom || '—' }}</td>
              <td>
                <div class="status-cell">
                  <span class="status-badge" :class="statusOf(j) === 'sorti' ? 'out' : 'in'">
                    {{ statusOf(j) === 'sorti' ? 'CHEZ CLIENT' : 'AU COMPTOIR' }}
                  </span>
                  <template v-if="j.status === 'sorti'">
                    <span class="status-client"><i class="fas fa-user"></i> {{ j.clientNom || 'Anonyme' }}</span>
                    <span class="status-since"><i class="far fa-clock"></i> {{ formatTime(j.sortieAt) }}</span>
                  </template>
                </div>
              </td>
              <td style="text-align:center;">
                <div class="table-actions">
                  <button v-if="j.status === 'sorti'" class="ret" @click="rentrerUn(j)" title="Rentrer le jeton"><i class="fas fa-sign-in-alt"></i></button>
                  <button @click="editJeton(j)" title="Modifier"><i class="fas fa-edit"></i></button>
                  <button class="del" @click="deleteJeton(j.id)" title="Supprimer"><i class="fas fa-trash-alt"></i></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="hasMore" class="show-more-wrap">
        <button class="btn-show-more" @click="showMore"><i class="fas fa-chevron-down"></i> Afficher plus ({{ filtered.length - visibleJetons.length }})</button>
      </div>
      <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
        <button class="action-btn primary" @click="generateJetonsFromPrompt"><i class="fas fa-wand-magic-sparkles"></i> Générer jetons</button>
        <button class="action-btn primary" :disabled="selectedJetons.length === 0" @click="printSelected"><i class="fas fa-print"></i> Imprimer ({{ selectedJetons.length }})</button>
        <button class="action-btn primary" @click="exportPDF('jetons')"><i class="fas fa-file-pdf"></i> Export PDF</button>
        <button v-if="outsCount > 0" class="action-btn ok" @click="rentrerTous"><i class="fas fa-sign-in-alt"></i> Rentrer tout ({{ outsCount }})</button>
        <button class="action-btn danger" @click="clearAllJetons()"><i class="fas fa-trash-alt"></i> Tout supprimer</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useJetonStore } from '../composables/useJetonStore'
import { useToast } from '../composables/useToast'
import { useExport } from '../composables/useExport'
import { formatDuration } from '../utils'

const { jetons, deleteJeton, updateJeton, clearAllJetons, generateJetons, rentrerJeton, rentrerTousJetons } = useJetonStore()
const toast = useToast()
const { exportPDF, printJetons } = useExport()

const searchInput = ref('')
const search = ref('')
const typeFilter = ref('')
const statusFilter = ref('')
const selectedIds = ref(new Set())
const displayCount = ref(120)

let debounceTimer = null

function onSearch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { search.value = searchInput.value }, 150)
}

const filtered = computed(() => {
  let list = jetons.value
  const s = search.value.toLowerCase().trim()
  if (s) list = list.filter(j => j.id.toLowerCase().includes(s) || (j.nom && j.nom.toLowerCase().includes(s)))
  if (typeFilter.value) list = list.filter(j => j.type === typeFilter.value)
  if (statusFilter.value) list = list.filter(j => statusOf(j) === statusFilter.value)
  return list
})

const visibleJetons = computed(() => filtered.value.slice(0, displayCount.value))
const hasMore = computed(() => filtered.value.length > displayCount.value)

function showMore() {
  displayCount.value += 120
}

const availableTypes = computed(() => {
  const set = new Set(jetons.value.map(j => j.type).filter(Boolean))
  return [...set]
})

const selectedJetons = computed(() => jetons.value.filter(j => selectedIds.value.has(j.id)))

const allSelected = computed(() => filtered.value.length > 0 && selectedIds.value.size === filtered.value.length)

const outsCount = computed(() => jetons.value.filter(j => j.status === 'sorti').length)
const availableCount = computed(() => jetons.value.filter(j => j.status !== 'sorti').length)

function statusOf(j) {
  return j.status === 'sorti' ? 'sorti' : 'disponible'
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function toggleSelect(id) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id)
  else selectedIds.value.add(id)
}

function toggleSelectAll() {
  if (allSelected.value) selectedIds.value.clear()
  else filtered.value.forEach(j => selectedIds.value.add(j.id))
}

function printSelected() {
  printJetons(selectedJetons.value)
}

function generateJetonsFromPrompt() {
  const count = parseInt(prompt('Nombre de jetons à générer :', '40'), 10)
  if (!count || count < 1 || count > 200) {
    toast.error('Nombre invalide (1 à 200)')
    return
  }
  const type = prompt('Type d\'appareil :', 'Charge téléphone') || 'Inconnu'
  generateJetons(count, type)
}

function editJeton(j) {
  const newType = prompt('Type d\'appareil :', j.type) || j.type
  const newNom = prompt('Nom :', j.nom) || j.nom
  if (newType !== j.type || newNom !== j.nom) {
    updateJeton(j.id, newType, newNom)
  }
}

function rentrerUn(j) {
  const ret = rentrerJeton(j.id)
  if (ret) {
    const duree = formatDuration(ret.duree)
    toast.success(duree ? `Jeton N° ${j.numero} rentré (durée : ${duree})` : `Jeton N° ${j.numero} rentré`)
  }
}

function rentrerTous() {
  rentrerTousJetons()
}
</script>
