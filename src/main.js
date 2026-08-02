import { createApp } from 'vue'
import App from './App.vue'
import '@fortawesome/fontawesome-free/css/all.min.css'
import './assets/main.css'

createApp(App).mount('#app')

const isCapacitor = typeof window !== 'undefined' && 'Capacitor' in window

if ('serviceWorker' in navigator && import.meta.env.PROD && !isCapacitor) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
