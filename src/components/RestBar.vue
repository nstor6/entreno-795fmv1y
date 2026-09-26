<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { formatRest } from '../domain/format'
import { formatClock, restState, type RestPhase } from '../domain/rest'

const props = defineProps<{ name: string; startedAt: number; minSec: number; maxSec: number }>()
const emit = defineEmits<{ stop: [] }>()

const BAR_HEIGHT = '76px'
/** Past the maximum, the bar goes away by itself after this long. */
const AUTO_HIDE_SEC = 180

const now = ref(Date.now())
const timer = setInterval(() => (now.value = Date.now()), 250)

const state = computed(() => restState(props.startedAt, now.value, props.minSec, props.maxSec))
const range = computed(() => formatRest(props.minSec, props.maxSec))
const clock = computed(() => (state.value.phase === 'resting' ? formatClock(state.value.remainingSec) : formatClock(state.value.elapsedSec)))
const title = computed(() => {
  if (state.value.phase === 'resting') return `Descanso · ${props.name}`
  if (state.value.phase === 'ready') return 'Ya puedes seguir'
  return 'Descanso terminado'
})
const subtitle = computed(() => {
  if (state.value.phase === 'resting') return `Plan: ${range.value}`
  if (state.value.phase === 'ready') return `Llevas ${formatClock(state.value.elapsedSec)} · máx. ${formatClock(props.maxSec)}`
  return `Llevas ${formatClock(state.value.elapsedSec)}`
})

// Buzz when the minimum is reached and again at the maximum (only while the app is on screen).
function buzz() {
  if (document.visibilityState === 'visible') navigator.vibrate?.([200, 100, 200])
}
watch(
  () => state.value.phase,
  (phase: RestPhase, before: RestPhase | undefined) => {
    if (before && phase !== before) buzz()
  },
)
watch(
  () => state.value.phase === 'over' && state.value.elapsedSec - Math.max(props.minSec, props.maxSec) > AUTO_HIDE_SEC,
  (hide) => hide && emit('stop'),
)

onMounted(() => document.documentElement.style.setProperty('--rest-bar-h', BAR_HEIGHT))
onBeforeUnmount(() => {
  clearInterval(timer)
  document.documentElement.style.removeProperty('--rest-bar-h')
})
</script>

<template>
  <div class="rest-bar" :class="state.phase" role="timer" :aria-label="`${title}. ${clock}`">
    <span class="clock num" aria-hidden="true">{{ clock }}</span>
    <span class="text">
      <strong>{{ title }}</strong>
      <span class="small">{{ subtitle }}</span>
    </span>
    <button type="button" class="stop" aria-label="Parar descanso" @click="emit('stop')">✕</button>
  </div>
</template>

<style scoped>
.rest-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(var(--nav-h) + env(safe-area-inset-bottom));
  height: 76px;
  z-index: 15;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 8px 0 16px;
  background: var(--surface);
  border-top: 3px solid var(--action);
  box-shadow: 0 -1px 0 var(--line);
}
.rest-bar.ready,
.rest-bar.over {
  background: var(--action);
  border-top-color: var(--action);
  color: var(--on-action);
}
.clock {
  font-size: 44px;
  min-width: 96px;
}
.text {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.text strong {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.stop {
  width: var(--tap);
  height: var(--tap);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  font-size: 22px;
}
</style>
