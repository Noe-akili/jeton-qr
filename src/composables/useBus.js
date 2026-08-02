const listeners = {}

export function on(name, cb) {
  if (!listeners[name]) listeners[name] = []
  listeners[name].push(cb)
  return () => {
    listeners[name] = (listeners[name] || []).filter(f => f !== cb)
  }
}

export function emit(name, payload) {
  ;(listeners[name] || []).slice().forEach(cb => {
    try { cb(payload) } catch (e) {}
  })
}
