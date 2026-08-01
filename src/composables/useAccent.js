import { ref, watch } from 'vue'

const accent = ref(localStorage.getItem('accent') || 'purple')

watch(accent, (val) => {
  document.documentElement.setAttribute('data-accent', val)
  localStorage.setItem('accent', val)
}, { immediate: true })

export function useAccent() {
  const change = (val) => { accent.value = val }
  return { accent, change }
}
