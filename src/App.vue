<template>
  <div class="app-container">
    <KeepAlive>
      <component :is="currentView" />
    </KeepAlive>
  </div>

  <nav class="bottom-nav">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      class="nav-item"
      :class="{ active: active === tab.key }"
      @click="onNavClick(tab)"
    >
      <i class="fas" :class="tab.icon"></i>
      <span>{{ tab.label }}</span>
      <span
        v-if="tab.badgeKey"
        class="nav-badge"
        :class="{ show: badgeCount(tab.badgeKey) > 0 }"
      >{{ badgeCount(tab.badgeKey) }}</span>
    </button>
  </nav>

  <ToastContainer />
</template>

<script setup>
import { ref, shallowRef, onMounted, defineAsyncComponent } from 'vue'
import ToastContainer from './components/ui/ToastContainer.vue'
import ScannerView from './views/ScannerView.vue'
import { useJetonStore } from './composables/useJetonStore'

const GeneratorView = defineAsyncComponent(() => import('./views/GeneratorView.vue'))
const JetonsView = defineAsyncComponent(() => import('./views/JetonsView.vue'))
const HistoryView = defineAsyncComponent(() => import('./views/HistoryView.vue'))
const SettingsView = defineAsyncComponent(() => import('./views/SettingsView.vue'))

const views = {
  scanner: ScannerView,
  generate: GeneratorView,
  jetons: JetonsView,
  history: HistoryView,
  settings: SettingsView,
}

const tabs = [
  { key: 'scanner', icon: 'fa-qrcode', label: 'Scanner' },
  { key: 'generate', icon: 'fa-pen-fancy', label: 'Générer' },
  { key: 'jetons', icon: 'fa-database', label: 'Jetons', badgeKey: 'jetons' },
  { key: 'history', icon: 'fa-history', label: 'Historique', badgeKey: 'history' },
  { key: 'settings', icon: 'fa-cog', label: 'Paramètres' },
]

const active = ref('scanner')
const currentView = shallowRef(views.scanner)

const { jetons, history, load } = useJetonStore()

function badgeCount(key) {
  if (key === 'jetons') return jetons.value.length
  if (key === 'history') return history.value.length
  return 0
}

function switchView(key) {
  active.value = key
  currentView.value = views[key]
}

function onNavClick(tab) {
  switchView(tab.key)
}

onMounted(() => {
  load()
})
</script>
