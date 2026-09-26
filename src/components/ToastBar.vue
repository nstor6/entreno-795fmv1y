<script setup lang="ts">
import { dismissToast, runToastAction, toast } from '../ui/toast'
</script>

<template>
  <div class="toast-slot" aria-live="polite">
    <div v-if="toast.current" :key="toast.current.id" class="toast" role="status">
      <span class="text">{{ toast.current.text }}</span>
      <button v-if="toast.current.action" type="button" class="action" @click="runToastAction">
        {{ toast.current.action.label }}
      </button>
      <button v-else type="button" class="action" aria-label="Cerrar aviso" @click="dismissToast">✕</button>
    </div>
  </div>
</template>

<style scoped>
.toast-slot {
  position: fixed;
  left: 0;
  right: 0;
  /* Above the tab bar and, during a session, above the rest bar. */
  bottom: calc(var(--nav-h) + env(safe-area-inset-bottom) + var(--rest-bar-h, 0px) + 8px);
  display: flex;
  justify-content: center;
  padding: 0 16px;
  pointer-events: none;
  z-index: 20;
}
.toast {
  pointer-events: auto;
  width: 100%;
  max-width: 528px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 4px 4px 16px;
  border-radius: var(--radius);
  background: var(--ink);
  color: var(--bg);
  font-weight: 700;
}
.text {
  flex: 1;
}
.action {
  min-height: var(--tap);
  min-width: var(--tap);
  padding: 0 14px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--bg);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
