<template>
  <div class="view">
    <div class="page-header">
      <h1><i class="fas fa-cog"></i> Paramètres</h1>
    </div>

    <h2 class="settings-section"><i class="fas fa-sync-alt"></i> Synchronisation</h2>
    <div class="card">
      <div class="settings-item">
        <div class="info"><span class="title">Nom de l'appareil</span><span class="desc">Qui scanne ? (affiché sur l'historique des autres)</span></div>
        <input class="settings-input" type="text" v-model="deviceName" @change="onDeviceName" :placeholder="'Appareil'">
      </div>
      <div class="settings-item">
        <div class="info"><span class="title">Synchronisation active</span><span class="desc">Envoyer / recevoir les scans entre appareils</span></div>
        <div class="toggle-switch" :class="{ active: serverEnabled }" @click="onToggleSync"><div class="thumb"></div></div>
      </div>
      <div class="settings-item">
        <div class="info"><span class="title">Port du serveur local</span><span class="desc">Appliqué au prochain démarrage</span></div>
        <input class="settings-input small" type="number" v-model.number="port" @change="onPort">
      </div>
      <div class="settings-item" v-if="status.nodeRunning">
        <div class="info"><span class="title">Mon adresse</span><span class="desc">À donner aux autres appareils</span></div>
        <span class="addr-chip">{{ status.ip }}:{{ status.port }}</span>
      </div>
      <div class="settings-item column">
        <div class="info"><span class="title">Autres appareils</span><span class="desc">Une adresse IP:port par ligne</span></div>
        <textarea class="settings-textarea" v-model="peersRaw" @change="onPeers" rows="3" placeholder="192.168.1.20:8123"></textarea>
      </div>
      <div class="settings-item">
        <div class="info"><span class="title">Synchroniser maintenant</span><span class="desc">Récupérer les derniers scans des autres</span></div>
        <button @click="doSync"><i class="fas fa-sync-alt"></i> Synchro</button>
      </div>
      <div class="settings-item">
        <div class="info">
          <span class="title">État</span>
          <span class="desc">
            <span v-if="status.nodeRunning" class="sync-ok"><i class="fas fa-circle"></i> Serveur local : {{ status.ip }}:{{ status.port }}</span>
            <span v-else class="sync-warn"><i class="fas fa-circle"></i> Serveur local arrêté</span>
            <span class="sync-line" v-if="status.lastSync">Dernière synchro : {{ formatTime(status.lastSync) }} · {{ status.peersOk }}/{{ status.peersTotal }} appareils</span>
            <span class="sync-err" v-if="status.lastError">⚠ {{ status.lastError }}</span>
          </span>
        </div>
      </div>
    </div>

    <h2 class="settings-section"><i class="fas fa-network-wired"></i> Appareils du réseau</h2>
    <div class="card">
      <div class="settings-item">
        <div class="info">
          <span class="title">Détection automatique</span>
          <span class="desc">Rechercher les appareils avec l'app sur le même réseau (Wi-Fi, partage USB, hotspot)</span>
        </div>
        <div class="toggle-switch" :class="{ active: discoveryOn }" @click="onToggleDiscovery"><div class="thumb"></div></div>
      </div>
      <div class="settings-item">
        <div class="info"><span class="title">Scanner le réseau</span><span class="desc">Chercher les autres appareils maintenant</span></div>
        <button @click="doDiscover"><i class="fas fa-search"></i> Scanner</button>
      </div>
      <div class="settings-item column">
        <div class="info">
          <span class="title">Appareils trouvés</span>
          <span class="desc">Appuyez sur « Ajouter » pour les synchroniser</span>
        </div>
        <div class="peer-list">
          <div v-if="discoveredPeers.length === 0" class="peer-empty">
            {{ discoveryOn ? 'Aucun appareil détecté pour le moment...' : 'Activez la détection ou lancez un scan pour trouver les appareils.' }}
          </div>
          <div v-for="p in discoveredPeers" :key="p.ip + ':' + p.port" class="peer-row">
            <div class="peer-info">
              <span class="peer-name"><i class="fas fa-mobile-alt"></i> {{ p.name }}</span>
              <span class="peer-addr">{{ p.ip }}:{{ p.port }}</span>
            </div>
            <button v-if="!isPeerAdded(p)" class="peer-add" @click="addPeer(p)"><i class="fas fa-plus"></i> Ajouter</button>
            <span v-else class="peer-added"><i class="fas fa-check"></i> Ajouté</span>
          </div>
        </div>
      </div>
      <div class="settings-item">
        <div class="info">
          <span class="title">À propos</span>
          <span class="desc">La détection fonctionne sur le même réseau local (Wi-Fi, USB, hotspot). Pour une liaison internet, ajoutez l'adresse IP:port manuellement dans « Autres appareils ».</span>
        </div>
      </div>
    </div>

    <h2 class="settings-section"><i class="fas fa-palette"></i> Apparence</h2>
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
    </div>

    <h2 class="settings-section"><i class="fas fa-database"></i> Données</h2>
    <div class="card">
      <div class="settings-item">
        <div class="info"><span class="title">Exporter les données</span><span class="desc">Sauvegarder tout (jetons + historique + config) dans Documents</span></div>
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
        <div class="info"><span class="title">À propos</span><span class="desc">JETON-QR Pro+ v4.0 — stockage natif + synchro réseau</span></div>
        <button @click="toast.info('JETON-QR App - Version 4.0')">Info</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useTheme } from '../composables/useTheme'
import { useAccent } from '../composables/useAccent'
import { useJetonStore } from '../composables/useJetonStore'
import { useToast } from '../composables/useToast'
import { useExport } from '../composables/useExport'
import { useConfig } from '../composables/useConfig'
import { useSync } from '../composables/useSync'

const { theme, toggle } = useTheme()
const { accent, change } = useAccent()
const { resetAll } = useJetonStore()
const toast = useToast()
const { exportJSON, importJSON } = useExport()
const { deviceName, serverEnabled, port, peersRaw, saveConfig, peersList } = useConfig()
const { status, syncNow, setSyncEnabled, discoveredPeers, discoveryOn, discoverNow, setDiscoveryOn } = useSync()

const isDark = computed(() => theme.value === 'dark')

function changeAccent() {
  change(accent.value)
  toast.success('Couleur changée')
}

function onDeviceName() {
  if (!deviceName.value.trim()) deviceName.value = 'Appareil'
  saveConfig()
  toast.success('Nom de l\'appareil enregistré')
}

function onPort() {
  if (!port.value || port.value < 1 || port.value > 65535) port.value = 8123
  saveConfig()
  toast.success('Port enregistré (effet au prochain démarrage)')
}

function onPeers() {
  saveConfig()
  toast.success('Appareils enregistrés')
}

function onToggleDiscovery() {
  setDiscoveryOn(!discoveryOn.value)
  toast.info(discoveryOn.value ? 'Détection activée' : 'Détection désactivée')
}

function doDiscover() {
  if (!status.nodeRunning) {
    toast.warning('Serveur local non démarré')
    return
  }
  toast.info('Scan du réseau en cours...')
  discoverNow()
}

function isPeerAdded(p) {
  const addr = p.ip + ':' + p.port
  return peersList().some(x => x === addr)
}

function addPeer(p) {
  const addr = p.ip + ':' + p.port
  if (isPeerAdded(p)) {
    toast.info('Déjà dans la liste')
    return
  }
  peersRaw.value = (peersRaw.value.trim() ? peersRaw.value.trim() + '\n' : '') + addr
  saveConfig()
  toast.success(`${p.name} ajouté (${addr})`)
}

function onToggleSync() {
  setSyncEnabled(!serverEnabled.value)
  toast.info(serverEnabled.value ? 'Synchronisation activée' : 'Synchronisation désactivée')
}

async function doSync() {
  if (!serverEnabled.value) {
    toast.warning('Activez d\'abord la synchronisation')
    return
  }
  toast.info('Synchronisation en cours...')
  try {
    await syncNow()
    toast.success('Synchronisation terminée')
  } catch (e) {
    toast.error(e.message)
  }
}

function formatTime(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  status.value.lastSync = status.value.lastSync
})
</script>

<style scoped>
.settings-section {
  display: flex; align-items: center; gap: 8px;
  font-size: 0.95rem; margin: 20px 0 8px; color: var(--text-light);
  text-transform: uppercase; letter-spacing: 1px;
}
.settings-input {
  width: 140px; padding: 6px 12px; border-radius: 40px; border: 1px solid var(--border);
  background: var(--bg); color: var(--text); font-weight: 600; text-align: right;
}
.settings-input.small { width: 80px; }
.settings-input:focus { outline: none; border-color: var(--primary); }
.settings-item.column { flex-direction: column; align-items: flex-start; gap: 8px; }
.settings-textarea {
  width: 100%; box-sizing: border-box; padding: 8px 12px; border-radius: 12px;
  border: 1px solid var(--border); background: var(--bg); color: var(--text);
  font-family: inherit; resize: vertical;
}
.settings-textarea:focus { outline: none; border-color: var(--primary); }
.addr-chip {
  background: var(--primary-light); color: var(--primary-dark); padding: 4px 12px;
  border-radius: 40px; font-weight: 700; font-size: 0.9rem;
}
.peer-list {
  display: flex; flex-direction: column; gap: 8px; width: 100%; box-sizing: border-box;
}
.peer-row {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 10px 12px; border: 1px solid var(--border); border-radius: 12px;
  background: var(--bg);
}
.peer-info { display: flex; flex-direction: column; min-width: 0; }
.peer-name { font-weight: 700; font-size: 0.92rem; color: var(--text); }
.peer-addr { font-size: 0.8rem; color: var(--text-light); font-family: monospace; }
.peer-add {
  padding: 6px 12px; border-radius: 40px; border: none; cursor: pointer;
  background: var(--primary); color: #fff; font-weight: 700; font-size: 0.82rem;
  white-space: nowrap;
}
.peer-added { color: #10B981; font-weight: 700; font-size: 0.85rem; white-space: nowrap; }
.peer-empty { text-align: center; color: var(--text-light); font-size: 0.85rem; padding: 12px; width: 100%; }
.sync-line { display: block; margin-top: 2px; }
.sync-err { display: block; margin-top: 2px; color: #EF4444; }
.sync-ok { color: #10B981; }
.sync-ok i { font-size: 0.6rem; }
.sync-warn { color: var(--text-light); }
.sync-warn i { font-size: 0.6rem; }
</style>
