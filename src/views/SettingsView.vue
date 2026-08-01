<template>
  <div class="view">
    <div class="page-header">
      <h1><i class="fas fa-cog"></i> Paramètres</h1>
    </div>
    <div class="card">
      <div class="settings-item">
        <div class="info"><span class="title">Thème sombre</span><span class="desc">Activer le mode nuit</span></div>
        <div class="toggle-switch" :class="{ active: isDark }" @click="toggle"><div class="thumb"></div></div>
      </div>
      <div class="settings-item">
        <div class="info"><span class="title">Couleur d'accent</span><span class="desc">Changer la couleur principale</span></div>
        <select v-model="accent" @change="changeAccent">
          <option value="purple">Violet</option>
          <option value="blue">Bleu</option>
          <option value="green">Vert</option>
          <option value="red">Rouge</option>
          <option value="orange">Orange</option>
        </select>
      </div>
      <div class="settings-item">
        <div class="info"><span class="title">Exporter les données</span><span class="desc">Sauvegarder tout (jetons + historique)</span></div>
        <button @click="exportJSON()"><i class="fas fa-file-export"></i> Exporter</button>
      </div>
      <div class="settings-item">
        <div class="info"><span class="title">Importer des données</span><span class="desc">Restaurer à partir d'un fichier JSON</span></div>
        <button @click="importJSON()"><i class="fas fa-file-import"></i> Importer</button>
      </div>
      <div class="settings-item">
        <div class="info"><span class="title">Réinitialiser tout</span><span class="desc">Supprimer toutes les données</span></div>
        <button class="danger" @click="resetAll()">Réinitialiser</button>
      </div>
      <div class="settings-item">
        <div class="info"><span class="title">À propos</span><span class="desc">JETON-QR Pro+ v3.0</span></div>
        <button @click="toast.info('JETON-QR App - Version 3.0 avec générateur et PDF')">Info</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useTheme } from '../composables/useTheme'
import { useAccent } from '../composables/useAccent'
import { useJetonStore } from '../composables/useJetonStore'
import { useToast } from '../composables/useToast'
import { useExport } from '../composables/useExport'

const { theme, toggle } = useTheme()
const { accent, change } = useAccent()
const { resetAll } = useJetonStore()
const toast = useToast()
const { exportJSON, importJSON } = useExport()

const isDark = computed(() => theme.value === 'dark')

function changeAccent() {
  change(accent.value)
  toast.success('Couleur changée')
}
</script>
