<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast-pop">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="toast"
          :class="t.variant"
          @click="remove(t.id)"
        >
          <i class="fas" :class="iconFor(t.variant)"></i>
          <span>{{ t.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { useToast } from '../../composables/useToast'

const { toasts, remove } = useToast()

const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' }
function iconFor(variant) {
  return icons[variant] || 'fa-info-circle'
}
</script>
