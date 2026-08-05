import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

function pwaPrecache() {
  let outDir = 'dist'
  let files = []
  return {
    name: 'pwa-precache',
    configResolved(config) {
      outDir = config.build.outDir
    },
    generateBundle(_options, bundle) {
      files = Object.keys(bundle)
    },
    closeBundle() {
      const swPath = join(outDir, 'sw.js')
      try {
        const sw = readFileSync(swPath, 'utf-8')
        const list = [
          '/',
          '/manifest.webmanifest',
          '/icon-180.png',
          '/icon-192.png',
          '/icon-512.png',
          '/icon-512-maskable.png',
          ...files.map((n) => '/' + n),
        ]
        const json = JSON.stringify(list)
        const version = createHash('md5').update(json).digest('hex').slice(0, 8)
        writeFileSync(
          swPath,
          sw.replace('__CACHE_VERSION__', version).replace('__PRECACHE__', json)
        )
      } catch (e) {
        console.warn('[pwa-precache]', e.message)
      }
    },
  }
}

export default defineConfig({
  plugins: [vue(), pwaPrecache()],
  server: {
    port: 3000,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('html2pdf') || id.includes('jspdf') || id.includes('html2canvas')) return 'pdf'
            if (id.includes('jsqr') || id.includes('qrcode')) return 'qr'
            if (id.includes('vue')) return 'vue'
            return 'vendor'
          }
        },
      },
    },
  },
})
