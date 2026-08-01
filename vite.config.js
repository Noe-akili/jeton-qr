import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
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
