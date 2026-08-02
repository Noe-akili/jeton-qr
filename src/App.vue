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
import { ref, shallowRef, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import ToastContainer from './components/ui/ToastContainer.vue'
import ScannerView from './views/ScannerView.vue'
import { useJetonStore } from './composables/useJetonStore'
import { useTheme } from './composables/useTheme'
import { useConfig } from './composables/useConfig'
import { useSync } from './composables/useSync'

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

let backListener = null
onMounted(async () => {
  const { loadConfig } = useConfig()
  const { initSync } = useSync()
  await Promise.all([load(), loadConfig()])
  initSync()
  if (window.Capacitor?.Plugins?.App) {
    const { App } = window.Capacitor.Plugins
    const order = tabs.map(t => t.key)
    backListener = App.addListener('backButton', () => {
      const idx = order.indexOf(active.value)
      if (idx > 0) {
        switchView(order[idx - 1])
      } else {
        App.minimizeApp()
      }
    })
  }
})

onUnmounted(() => {
  backListener?.remove()
})
</script>
