<template>
  <div class="view">
    <div class="page-header">
      <h1><i class="fas fa-pen-fancy"></i> Générer</h1>
      <span class="badge">QR Code</span>
    </div>
    <div class="card">
      <div class="card-title"><i class="fas fa-edit"></i> Créer un QR code</div>
      <div class="qr-input-group">
        <textarea v-model="qrText" placeholder="Saisissez le texte, URL ou toute donnée à encoder..."></textarea>
        <button class="btn-generate" @click="generateQR">
          <i class="fas fa-sync-alt"></i> Générer
        </button>
      </div>
      <div class="qr-preview" v-show="showPreview">
        <div class="qrcode-box">
          <canvas ref="canvasEl"></canvas>
        </div>
        <div class="qr-actions">
          <button @click="downloadQR"><i class="fas fa-download"></i> Télécharger PNG</button>
          <button @click="saveJetonFromQR"><i class="fas fa-save"></i> Enregistrer comme jeton</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import QRCode from 'qrcode'
import { useJetonStore } from '../composables/useJetonStore'
import { useToast } from '../composables/useToast'

const qrText = ref('')
const canvasEl = ref(null)
const showPreview = ref(false)
const lastGeneratedText = ref('')

const { addJeton } = useJetonStore()
const toast = useToast()

async function generateQR() {
  const text = qrText.value.trim()
  if (!text) {
    toast.error('Veuillez saisir du texte')
    return
  }
  lastGeneratedText.value = text
  showPreview.value = true
  await nextTick()
  try {
    await QRCode.toCanvas(canvasEl.value, text, {
      width: 200,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    })
    toast.success('QR code généré')
  } catch (e) {
    toast.error('Erreur de génération')
  }
}

function downloadQR() {
  if (!lastGeneratedText.value) {
    toast.error('Générez d\'abord un QR code')
    return
  }
  const canvas = canvasEl.value
  if (!canvas) { toast.error('Erreur'); return }
  const link = document.createElement('a')
  link.download = 'qr_code.png'
  link.href = canvas.toDataURL('image/png')
  link.click()
  toast.success('Image téléchargée')
}

function saveJetonFromQR() {
  const text = lastGeneratedText.value
  if (!text) {
    toast.error('Générez d\'abord un QR code')
    return
  }
  const type = prompt('Type d\'appareil :', 'Inconnu') || 'Inconnu'
  const nom = prompt('Nom :', 'Anonyme') || 'Anonyme'
  addJeton(text, type, nom)
}
</script>
