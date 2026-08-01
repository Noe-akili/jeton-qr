<template>
  <div class="view">
    <div class="page-header">
      <h1><i class="fas fa-qrcode"></i> Scanner</h1>
      <span class="badge">{{ outsCount }} chez client</span>
    </div>
    <div class="card">
      <div class="video-wrapper">
        <video ref="videoEl" class="video-element" playsinline muted></video>
        <div v-if="scanning" class="scan-overlay">
          <div class="corner tl"></div><div class="corner tr"></div>
          <div class="corner bl"></div><div class="corner br"></div>
          <div class="scan-line"></div>
        </div>
        <div v-else class="video-placeholder">
          <i class="fas fa-video"></i>
          <span>Caméra arrêtée</span>
        </div>
      </div>
      <div class="controls-row">
        <button class="primary" @click="startScanner" :disabled="scanning"><i class="fas fa-play"></i> Démarrer</button>
        <button class="danger" @click="stopScanner" :disabled="!scanning"><i class="fas fa-stop"></i> Arrêter</button>
        <button @click="toggleTorch"><i class="fas fa-lightbulb"></i> Lampe</button>
        <button class="success" @click="scanFromGallery"><i class="fas fa-image"></i> Galerie</button>
      </div>
      <div class="result-box">
        <span class="label"><i class="fas fa-barcode"></i> Résultat :</span>
        <span class="value">{{ resultLabel || 'En attente...' }}</span>
        <span v-if="result" class="type-badge" :class="resultClass">{{ resultBadge }}</span>
        <span v-else class="type-badge">—</span>
        <div class="actions">
          <button @click="copyResult"><i class="fas fa-copy"></i> Copier</button>
          <button @click="shareResult"><i class="fas fa-share-alt"></i></button>
          <button v-if="canSaveResult" @click="saveJeton"><i class="fas fa-save"></i> Enregistrer</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'
import jsQR from 'jsqr'
import { useJetonStore } from '../composables/useJetonStore'
import { useToast } from '../composables/useToast'
import { detectType } from '../utils'

const videoEl = ref(null)
const result = ref('')
const resultLabel = ref('')
const resultBadge = ref('')
const resultClass = ref('')
const scanning = ref(false)

let stream = null
let rafId = null
let lastFrameTime = 0
let lastScannedData = null
let cooldownUntil = 0
let isTorchOn = false
let canvas = null
let ctx = null

const { addHistory, addJeton, sortirJeton, rentrerJeton, jetons } = useJetonStore()
const toast = useToast()

const outsCount = computed(() => jetons.value.filter(j => j.status === 'sorti').length)
const canSaveResult = computed(() => !!result.value && !jetons.value.some(j => j.id === result.value))

function isJetonLike(data) {
  return /^JTON-/i.test(data)
}

async function handleCode(raw) {
  if (cooldownUntil > Date.now()) return
  cooldownUntil = Date.now() + 2500
  lastScannedData = raw
  const data = raw.trim()

  let jeton = jetons.value.find(j => j.id === data)

  if (jeton && jeton.status === 'sorti') {
    const ret = rentrerJeton(jeton.id)
    if (!ret) return
    result.value = jeton.id
    resultLabel.value = `JETON N° ${jeton.numero} — appareil restitué`
    resultBadge.value = 'ENTRÉE'
    resultClass.value = 'ok'
    const duree = formatDuration(ret.duree)
    toast.success(duree ? `Appareil restitué (durée : ${duree})` : 'Appareil restitué au client')
    return
  }

  if (!jeton && !isJetonLike(data)) {
    addHistory(data)
    result.value = data
    resultLabel.value = data
    resultBadge.value = detectType(data) || 'SCAN'
    resultClass.value = 'muted'
    toast.info('Code scanné')
    return
  }

  const rep = prompt(jeton ? `Nom du client (jeton N° ${jeton.numero}) :` : 'Nouveau jeton — nom du client :', '')
  if (rep === null) {
    toast.info('Action annulée')
    if (jeton) {
      result.value = jeton.id
      resultLabel.value = `JETON N° ${jeton.numero}`
      resultBadge.value = 'ANNULÉ'
      resultClass.value = 'muted'
    }
    return
  }
  const clientNom = rep.trim()

  if (!jeton) {
    const type = prompt("Type d'appareil :", 'Charge téléphone')
    if (type === null) { toast.info('Action annulée'); return }
    addJeton(data, type || 'Inconnu', clientNom)
    jeton = jetons.value.find(j => j.id === data)
    if (!jeton) return
  }

  if (!sortirJeton(jeton.id, clientNom)) return
  result.value = jeton.id
  resultLabel.value = clientNom ? `JETON N° ${jeton.numero} — remis à ${clientNom}` : `JETON N° ${jeton.numero} — remis au client`
  resultBadge.value = 'SORTIE'
  resultClass.value = 'warn'
  toast.success('Jeton remis au client — appareil déposé')
}

function formatDuration(ms) {
  if (!ms || ms < 0) return ''
  const sec = Math.floor(ms / 1000)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}h ${m}min`
  if (m > 0) return `${m}min ${s}s`
  return `${s}s`
}

async function startScanner() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280, max: 1280 },
        height: { ideal: 720, max: 720 },
      },
      audio: false,
    })
    const track = stream.getVideoTracks()[0]
    if (track) {
      track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {})
    }
    videoEl.value.srcObject = stream
    videoEl.value.setAttribute('playsinline', true)
    await videoEl.value.play()
    scanning.value = true
    startScanLoop()
    toast.success('Caméra activée')
  } catch (err) {
    toast.error('Erreur caméra : ' + err.message)
  }
}

function stopScanner() {
  stopScanLoop()
  if (stream) {
    stream.getTracks().forEach(t => t.stop())
    stream = null
  }
  if (videoEl.value) videoEl.value.srcObject = null
  scanning.value = false
  isTorchOn = false
  cooldownUntil = 0
  lastScannedData = null
  toast.info('Caméra arrêtée')
}

function startScanLoop() {
  stopScanLoop()
  lastFrameTime = 0
  const loop = (now) => {
    rafId = requestAnimationFrame(loop)
    if (now - lastFrameTime < 100) return
    lastFrameTime = now
    processFrame()
  }
  rafId = requestAnimationFrame(loop)
}

function stopScanLoop() {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

function processFrame() {
  const video = videoEl.value
  if (!video || video.readyState < 2) return
  const w = video.videoWidth
  const h = video.videoHeight
  if (!w || !h) return
  if (cooldownUntil > Date.now()) return

  if (!canvas) {
    canvas = document.createElement('canvas')
    ctx = canvas.getContext('2d', { willReadFrequently: true })
  }
  const max = 640
  const scale = Math.min(1, max / Math.max(w, h))
  const cw = Math.max(1, Math.round(w * scale))
  const ch = Math.max(1, Math.round(h * scale))
  if (canvas.width !== cw) canvas.width = cw
  if (canvas.height !== ch) canvas.height = ch
  ctx.drawImage(video, 0, 0, cw, ch)

  let imageData
  try {
    imageData = ctx.getImageData(0, 0, cw, ch)
  } catch (e) {
    return
  }

  const code = jsQR(imageData.data, cw, ch, { inversionAttempts: 'attemptBoth' })
  if (code && code.data) {
    const data = code.data.trim()
    if (data && data !== lastScannedData) {
      handleCode(data)
    }
  }
}

async function toggleTorch() {
  if (!stream) {
    toast.error('Activez d\'abord la caméra')
    return
  }
  const track = stream.getVideoTracks()[0]
  if (!track) return
  try {
    const capabilities = track.getCapabilities()
    if (!capabilities.torch) {
      toast.error('Lampe non disponible')
      return
    }
    isTorchOn = !isTorchOn
    await track.applyConstraints({ advanced: [{ torch: isTorchOn }] })
    toast.info(isTorchOn ? 'Lampe allumée' : 'Lampe éteinte')
  } catch (e) {
    toast.error('Erreur lampe')
  }
}

function scanFromGallery() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.style.display = 'none'
  document.body.appendChild(input)
  input.onchange = async function(e) {
    const file = e.target.files[0]
    document.body.removeChild(input)
    if (!file) { toast.error('Aucun fichier sélectionné'); return }
    try {
      const url = URL.createObjectURL(file)
      const img = await loadImage(url)
      URL.revokeObjectURL(url)
      const c = scaleCanvas(img, 1600)
      const context = c.getContext('2d', { willReadFrequently: true })
      const imageData = context.getImageData(0, 0, c.width, c.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' })
      if (code && code.data) {
        handleCode(code.data)
      } else {
        toast.error('Aucun QR code trouvé')
      }
    } catch (err) {
      toast.error('Erreur de lecture de l\'image')
    }
  }
  input.click()
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('load'))
    img.src = src
  })
}

function scaleCanvas(img, max) {
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  const scale = Math.min(1, max / Math.max(w, h))
  const c = document.createElement('canvas')
  c.width = Math.round(w * scale)
  c.height = Math.round(h * scale)
  c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, c.width, c.height)
  return c
}

function copyResult() {
  if (!result.value) {
    toast.error('Rien à copier')
    return
  }
  navigator.clipboard.writeText(result.value).then(() => toast.success('Copié !'))
    .catch(() => {
      const ta = document.createElement('textarea')
      ta.value = result.value
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
      toast.success('Copié !')
    })
}

function shareResult() {
  if (!result.value) {
    toast.error('Rien à partager')
    return
  }
  if (navigator.share) {
    navigator.share({ title: 'JETON-QR', text: resultLabel.value || result.value }).catch(() => {})
  } else {
    toast.info('Partage non supporté')
  }
}

function saveJeton() {
  if (!result.value) {
    toast.error('Aucun code à enregistrer')
    return
  }
  const type = prompt('Type d\'appareil :', 'Inconnu') || 'Inconnu'
  const nom = prompt('Nom :', 'Anonyme') || 'Anonyme'
  addJeton(result.value, type, nom)
}

onUnmounted(stopScanner)
</script>
