<template>
  <div class="view">
    <div class="page-header">
      <h1><i class="fas fa-history"></i> Historique</h1>
      <span class="badge">{{ history.length }}</span>
    </div>
    <div class="card">
      <div class="history-search">
        <input type="text" v-model="searchInput" @input="onSearch" placeholder="🔍 Rechercher...">
      </div>
      <div class="history-list">
        <div v-if="filtered.length === 0" class="history-empty">{{ search ? 'Aucun résultat' : 'Aucun scan' }}</div>
        <div v-for="item in visibleHistory" :key="item.date" class="history-item" v-memo="[item, item.mouvement, item.clientNom]">
          <div class="content">
            <div class="data">{{ label(item) }}</div>
            <div class="meta">
              <span><i class="far fa-clock"></i> {{ item.timestamp }}</span>
              <span class="type-tag">{{ item.type || 'TEXTE' }}</span>
              <span v-if="item.mouvement" class="mvt-tag" :class="item.mouvement">{{ item.mouvement === 'sortie' ? 'SORTIE' : 'ENTRÉE' }}</span>
              <span v-if="item.clientNom" class="client-tag"><i class="fas fa-user"></i> {{ item.clientNom }}</span>
              <span v-if="item.device" class="device-tag"><i class="fas fa-mobile-alt"></i> {{ item.device }}</span>
            </div>
          </div>
          <button class="delete-btn" @click="deleteHistoryItem(history.indexOf(item))"><i class="fas fa-times"></i></button>
        </div>
      </div>
      <div v-if="hasMore" class="show-more-wrap">
        <button class="btn-show-more" @click="showMore"><i class="fas fa-chevron-down"></i> Afficher plus ({{ filtered.length - visibleHistory.length }})</button>
      </div>
      <div class="history-actions">
        <button @click="exportHistoryCSV()"><i class="fas fa-file-csv"></i> CSV</button>
        <button @click="exportPDF('history')"><i class="fas fa-file-pdf"></i> PDF</button>
        <button @click="clearHistory()"><i class="fas fa-eraser"></i> Effacer</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useJetonStore } from '../composables/useJetonStore'
import { useExport } from '../composables/useExport'

const searchInput = ref('')
const search = ref('')
const displayCount = ref(100)

let debounceTimer = null

function onSearch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { search.value = searchInput.value }, 150)
}

const { history, deleteHistoryItem, clearHistory, jetons } = useJetonStore()
const { exportHistoryCSV, exportPDF } = useExport()

function label(item) {
  if (item.label) return item.label
  const jeton = jetons.value.find(j => j.id === item.data)
  return jeton ? `JETON N° ${jeton.numero}` : item.data
}

const filtered = computed(() => {
  const s = search.value.toLowerCase().trim()
  if (!s) return history.value
  return history.value.filter(item => (item.data || '').toLowerCase().includes(s))
})

const visibleHistory = computed(() => filtered.value.slice(0, displayCount.value))
const hasMore = computed(() => filtered.value.length > displayCount.value)

function showMore() {
  displayCount.value += 100
}
</script>
