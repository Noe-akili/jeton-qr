import html2pdf from 'html2pdf.js'
import QRCode from 'qrcode'
import { useJetonStore } from './useJetonStore'
import { useToast } from './useToast'
import { downloadFile } from '../utils'

export function useExport() {
  const { jetons, history } = useJetonStore()
  const toast = useToast()

  function exportPDF(type) {
    let content = ''
    if (type === 'jetons') {
      if (jetons.value.length === 0) { toast.error('Aucun jeton à exporter'); return }
      content = `
        <h2 style="text-align:center;color:#6C3CE1;">Liste des jetons</h2>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">
          <tr style="background:#f0f0f0;"><th style="border:1px solid #ccc;padding:8px;">N°</th><th style="border:1px solid #ccc;padding:8px;">Appareil</th><th style="border:1px solid #ccc;padding:8px;">Nom</th><th style="border:1px solid #ccc;padding:8px;">Statut</th><th style="border:1px solid #ccc;padding:8px;">ID</th></tr>
          ${jetons.value.map(j => `<tr><td style="border:1px solid #ccc;padding:8px;">${j.numero}</td><td style="border:1px solid #ccc;padding:8px;">${j.type || '—'}</td><td style="border:1px solid #ccc;padding:8px;">${j.nom || '—'}</td><td style="border:1px solid #ccc;padding:8px;">${j.status === 'sorti' ? 'Chez client' + (j.clientNom ? ' (' + j.clientNom + ')' : '') : 'Au comptoir'}</td><td style="border:1px solid #ccc;padding:8px;">${j.id}</td></tr>`).join('')}
        </table>
        <p style="margin-top:20px;text-align:center;color:#888;">${jetons.value.filter(j => j.status === 'sorti').length} jeton(s) actuellement chez les clients — Exporté le ${new Date().toLocaleString()}</p>
      `
    } else {
      if (history.value.length === 0) { toast.error('Aucun historique'); return }
      content = `
        <h2 style="text-align:center;color:#6C3CE1;">Historique des scans</h2>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">
          <tr style="background:#f0f0f0;"><th style="border:1px solid #ccc;padding:8px;">Donnée</th><th style="border:1px solid #ccc;padding:8px;">Type</th><th style="border:1px solid #ccc;padding:8px;">Mouvement</th><th style="border:1px solid #ccc;padding:8px;">Client</th><th style="border:1px solid #ccc;padding:8px;">Date</th></tr>
          ${history.value.map(item => `<tr><td style="border:1px solid #ccc;padding:8px;">${item.label || item.data}</td><td style="border:1px solid #ccc;padding:8px;">${item.type || 'TEXTE'}</td><td style="border:1px solid #ccc;padding:8px;">${item.mouvement ? (item.mouvement === 'sortie' ? 'SORTIE' : 'ENTRÉE') : '—'}</td><td style="border:1px solid #ccc;padding:8px;">${item.clientNom || '—'}</td><td style="border:1px solid #ccc;padding:8px;">${item.timestamp}</td></tr>`).join('')}
        </table>
        <p style="margin-top:20px;text-align:center;color:#888;">Exporté le ${new Date().toLocaleString()}</p>
      `
    }
    const wrapper = document.createElement('div')
    wrapper.style.padding = '20px'
    wrapper.style.fontFamily = 'Segoe UI, sans-serif'
    wrapper.innerHTML = content
    document.body.appendChild(wrapper)
    html2pdf().set({
      margin: 10,
      filename: type === 'jetons' ? 'jetons.pdf' : 'historique.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }).from(wrapper).save().then(() => {
      document.body.removeChild(wrapper)
      toast.success('PDF exporté')
    }).catch(() => {
      document.body.removeChild(wrapper)
      toast.error('Erreur PDF')
    })
  }

  function exportHistoryCSV() {
    if (history.value.length === 0) { toast.error('Aucune donnée'); return }
    let csv = 'Donnée,Mouvement,Type,Client,Date\n'
    history.value.forEach(item => {
      const mvt = item.mouvement ? (item.mouvement === 'sortie' ? 'SORTIE' : 'ENTRÉE') : ''
      csv += `"${item.label || item.data}","${mvt}","${item.type || 'TEXTE'}","${item.clientNom || ''}","${item.timestamp}"\n`
    })
    downloadFile(csv, 'historique_scans.csv', 'text/csv')
    toast.success('CSV exporté')
  }

  function exportJSON() {
    const data = { jetons: jetons.value, history: history.value }
    const json = JSON.stringify(data, null, 2)
    downloadFile(json, 'jeton_qr_data.json', 'application/json')
    toast.success('Données exportées')
  }

  function importJSON() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = function(e) {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = function(ev) {
        try {
          const data = JSON.parse(ev.target.result)
          if (data.jetons) jetons.value = data.jetons
          if (data.history) history.value = data.history
          useJetonStore().save()
          toast.success('Import réussi')
        } catch (err) {
          toast.error('Fichier invalide')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  async function printJetons(selected) {
    if (!selected || selected.length === 0) { toast.error('Aucun jeton sélectionné'); return }

    let qrs = []
    try {
      qrs = await Promise.all(selected.map(j => QRCode.toDataURL(j.id, {
        width: 300,
        margin: 1,
        errorCorrectionLevel: 'M',
      })))
    } catch (e) {
      toast.error('Erreur de génération des QR codes')
      return
    }

    const wrapper = document.createElement('div')
    wrapper.style.width = '210mm'
    wrapper.style.fontFamily = 'Arial, Segoe UI, sans-serif'
    wrapper.style.background = '#ffffff'
    wrapper.style.color = '#000000'
    wrapper.style.boxSizing = 'border-box'

    const perPage = 40
    const chunks = []
    for (let i = 0; i < selected.length; i += perPage) {
      chunks.push(selected.slice(i, i + perPage))
    }

    const pages = chunks.map((chunk, p) => {
      const offset = p * perPage
      return `
        <div style="width:210mm;height:297mm;padding:5mm;box-sizing:border-box;page-break-after:always;display:flex;flex-direction:column;">
          <div style="text-align:center;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#222;margin-bottom:2mm;">JETON-QR PRO+</div>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);grid-template-rows:repeat(8,1fr);gap:2mm;flex:1;">
            ${chunk.map((j, idx) => `
              <div style="border:1.5px solid #222;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.5mm;text-align:center;box-sizing:border-box;padding:1mm;overflow:hidden;">
                <div style="font-size:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">STCOST</div>
                <img src="${qrs[offset + idx]}" alt="QR" style="width:17mm;height:17mm;" />
                <div style="font-weight:700;font-size:10px;color:#555;border-top:1px dashed #999;padding-top:0.5mm;width:100%;">Perte jeton 10$</div>
              </div>
            `).join('')}
          </div>
        </div>
      `
    }).join('')

    wrapper.innerHTML = pages

    document.body.appendChild(wrapper)
    try {
      await Promise.all(Array.from(wrapper.querySelectorAll('img')).map(img =>
        img.decode().catch(() => {})
      ))
    } catch (e) {}

    html2pdf().set({
      margin: 0,
      filename: 'jetons_impression.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }).from(wrapper).save().then(() => {
      document.body.removeChild(wrapper)
      toast.success('PDF d\'impression généré')
    }).catch(() => {
      document.body.removeChild(wrapper)
      toast.error('Erreur d\'impression')
    })
  }

  return { exportPDF, exportHistoryCSV, exportJSON, importJSON, printJetons, downloadFile }
}
