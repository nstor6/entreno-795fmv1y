<script setup lang="ts">
import { ref, watch } from 'vue'
import { formatNumber } from '../domain/format'

const props = defineProps<{
  value: number | null
  step: number
  label: string
  /** Shown when value is null, e.g. «sin carga». */
  placeholder?: string
  integer?: boolean
  /** With no value, the +/− buttons open the keyboard instead of stepping from 0. */
  typeWhenEmpty?: boolean
}>()
// `step` sends a delta so the owner applies it to its own latest value.
const emit = defineEmits<{ change: [value: number | null]; step: [delta: number] }>()

const text = ref('')
const input = ref<HTMLInputElement | null>(null)

function onStep(delta: number) {
  if (props.typeWhenEmpty && props.value === null) input.value?.focus()
  else emit('step', delta)
}
watch(
  () => props.value,
  (v) => (text.value = v === null ? '' : formatNumber(v)),
  { immediate: true },
)

function commit() {
  const raw = text.value.trim().replace(',', '.')
  if (raw === '') return emit('change', null)
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) {
    text.value = props.value === null ? '' : formatNumber(props.value)
    return
  }
  const clean = props.integer ? Math.round(n) : Math.round(n * 100) / 100
  text.value = formatNumber(clean)
  if (clean !== props.value) emit('change', clean)
}
</script>

<template>
  <div class="stepper">
    <span class="label">{{ label }}</span>
    <button type="button" class="step" :aria-label="`Menos ${label}`" @click="onStep(-step)">−</button>
    <input
      ref="input"
      v-model="text"
      class="value num"
      :inputmode="integer ? 'numeric' : 'decimal'"
      :aria-label="label"
      :placeholder="placeholder ?? '—'"
      enterkeyhint="done"
      @change="commit"
      @keydown.enter="($event.target as HTMLInputElement).blur()"
      @focus="($event.target as HTMLInputElement).select()"
    />
    <button type="button" class="step" :aria-label="`Más ${label}`" @click="onStep(step)">+</button>
  </div>
</template>

<style scoped>
.stepper {
  display: grid;
  grid-template-columns: 64px 56px minmax(0, 1fr) 56px;
  align-items: center;
  gap: 6px;
}
.label {
  color: var(--ink-2);
  font-size: 15px;
  font-weight: 700;
}
.step {
  height: 56px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line);
  background: var(--surface-2);
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
}
.step:active {
  background: var(--line);
}
.value {
  width: 100%;
  min-width: 0;
  height: 56px;
  border: none;
  background: transparent;
  text-align: center;
  font-size: 46px;
  padding: 0;
}
.value::placeholder {
  color: var(--ink-2);
  font-size: 22px;
}
.value:focus {
  outline: 3px solid var(--action);
  border-radius: var(--radius-sm);
}
</style>
