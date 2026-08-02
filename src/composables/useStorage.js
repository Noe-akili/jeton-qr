import { Preferences } from '@capacitor/preferences'

const isNative = typeof window !== 'undefined' && 'Capacitor' in window

export async function storageGet(key) {
  try {
    if (isNative) {
      const { value } = await Preferences.get({ key })
      if (value !== null && value !== undefined) return value
    }
  } catch (e) {}
  try {
    return localStorage.getItem(key)
  } catch (e) {}
  return null
}

export async function storageSet(key, value) {
  try {
    if (isNative) {
      await Preferences.set({ key, value })
      return
    }
  } catch (e) {}
  try {
    localStorage.setItem(key, value)
  } catch (e) {}
}

export async function storageRemove(key) {
  try {
    if (isNative) await Preferences.remove({ key })
  } catch (e) {}
  try {
    localStorage.removeItem(key)
  } catch (e) {}
}
