export function detectType(data) {
  if (/^https?:\/\//i.test(data)) return 'URL'
  if (/^[\w.-]+@[\w.-]+\.\w+$/.test(data)) return 'EMAIL'
  if (/^(\+?\d{1,3}[- ]?)?\(?\d{2,4}\)?[- ]?\d{3,4}[- ]?\d{4}$/.test(data)) return 'TÉLÉPHONE'
  if (/^-?\d+\.?\d*,\s*-?\d+\.?\d*$/.test(data)) return 'COORD'
  if (/^wifi:/i.test(data)) return 'WIFI'
  if (/^BEGIN:VCARD/i.test(data)) return 'VCARD'
  return 'TEXTE'
}

export function playFeedback() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.frequency.value = 1200
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1)
    osc.start()
    osc.stop(audioCtx.currentTime + 0.1)
  } catch (e) {}
  if (navigator.vibrate) navigator.vibrate(50)
}

export function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function formatDuration(ms) {
  if (!ms || ms < 0) return ''
  const sec = Math.floor(ms / 1000)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}h ${m}min`
  if (m > 0) return `${m}min ${s}s`
  return `${s}s`
}
