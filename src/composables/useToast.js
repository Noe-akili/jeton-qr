import { reactive } from 'vue'

const state = reactive({
  toasts: [],
})

let nextId = 0

function addToast(message, variant = 'info', duration = 3000) {
  const id = nextId++
  state.toasts.push({ id, message, variant })
  if (duration > 0) {
    setTimeout(() => removeToast(id), duration)
  }
}

function removeToast(id) {
  const i = state.toasts.findIndex(t => t.id === id)
  if (i !== -1) state.toasts.splice(i, 1)
}

export function useToast() {
  return {
    toasts: state.toasts,
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error', 5000),
    info: (msg) => addToast(msg, 'info'),
    warning: (msg) => addToast(msg, 'warning'),
    remove: removeToast,
  }
}
