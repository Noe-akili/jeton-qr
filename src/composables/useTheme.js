import { ref, watch } from 'vue'

const theme = ref(localStorage.getItem('theme') || 'light')

watch(theme, (val) => {
  document.documentElement.setAttribute('data-theme', val)
  localStorage.setItem('theme', val)
}, { immediate: true })

export function useTheme() {
  const toggle = () => { theme.value = theme.value === 'light' ? 'dark' : 'light' }
  return { theme, toggle, isDark: () => theme.value === 'dark' }
}
