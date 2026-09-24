<script setup lang="ts">
import { onBeforeUnmount, reactive, ref, watch } from 'vue'
import { db } from '../data/instance'
import { updateSet, type SetPatch } from '../data/session'
import { loadStep, stepValue, valueStep } from '../domain/setDraft'
import type { Exercise, SetLog } from '../domain/types'
import NumberStepper from './NumberStepper.vue'

const props = defineProps<{ set: SetLog; index: number; exercise: Exercise; altName: string | null }>()
const emit = defineEmits<{ remove: [] }>()

const RIRS = [0, 1, 2, 3, 4, 5] as const
const KNEE = Array.from({ length: 11 }, (_, i) => i)

const valueLabel = { reps: 'reps', meters: 'metros', seconds: 'seg.' } as const
const valueKey = { reps: 'reps', meters: 'distanceM', seconds: 'durationS' } as const

// Local copy so fast taps build on each other instead of on the last saved value.
// It follows the database only when none of our own writes are in flight.
const s = reactive<SetLog>({ ...props.set })
let inFlight = 0
watch(
  () => props.set,
  (fresh) => {
    if (inFlight === 0) Object.assign(s, fresh)
  },
)

function patch(p: SetPatch) {
  Object.assign(s, p)
  inFlight++
  void updateSet(db, s.id, p).finally(() => {
    inFlight--
    if (inFlight === 0) Object.assign(s, { ...props.set, ...pick(s) })
  })
}
function pick(src: SetLog): SetPatch {
  const { loadKg, reps, distanceM, durationS, rir, isWarmup, kneePain } = src
  return { loadKg, reps, distanceM, durationS, rir, isWarmup, kneePain }
}

function value(): number | null {
  return s[valueKey[props.exercise.measure]]
}
function setValue(v: number | null) {
  patch({ [valueKey[props.exercise.measure]]: v })
}

const kneeOpen = ref(props.set.kneePain !== null)

const confirmingDelete = ref(false)
let confirmTimer: ReturnType<typeof setTimeout> | undefined
function onDelete() {
  if (confirmingDelete.value) {
    clearTimeout(confirmTimer)
    emit('remove')
    return
  }
  confirmingDelete.value = true
  confirmTimer = setTimeout(() => (confirmingDelete.value = false), 3000)
}
onBeforeUnmount(() => clearTimeout(confirmTimer))
</script>

<template>
  <div class="set" :class="{ warmup: s.isWarmup }">
    <div class="top">
      <span class="title">
        Serie {{ index }}
        <span v-if="altName" class="muted small"> · {{ altName }}</span>
      </span>
      <button type="button" class="chip mini" :aria-pressed="s.isWarmup" @click="patch({ isWarmup: !s.isWarmup })">
        Calentamiento
      </button>
      <button type="button" class="chip mini danger" @click="onDelete">{{ confirmingDelete ? '¿Borrar?' : 'Borrar' }}</button>
    </div>

    <NumberStepper
      :value="s.loadKg"
      :step="loadStep(exercise)"
      :label="exercise.bodyweight ? 'lastre' : 'kg'"
      placeholder="sin carga"
      @change="(v) => patch({ loadKg: v })"
      @step="(d) => patch({ loadKg: stepValue(s.loadKg, d) })"
    />
    <NumberStepper
      :value="value()"
      :step="valueStep(exercise.measure)"
      :label="valueLabel[exercise.measure]"
      integer
      @change="setValue"
      @step="(d) => setValue(stepValue(value(), d))"
    />

    <div class="row">
      <span class="label">RIR</span>
      <div class="rir" role="group" aria-label="RIR">
        <button
          v-for="r in RIRS"
          :key="r"
          type="button"
          class="chip num-chip"
          :aria-pressed="s.rir === r"
          @click="patch({ rir: s.rir === r ? null : r })"
        >
          {{ r === 5 ? '5+' : r }}
        </button>
      </div>
    </div>

    <button v-if="!kneeOpen" type="button" class="btn btn-quiet knee-toggle" @click="kneeOpen = true">Anotar rodilla</button>
    <div v-else class="row">
      <span class="label">Rodilla</span>
      <div class="knee" role="group" aria-label="Rodilla de 0 a 10">
        <button
          v-for="k in KNEE"
          :key="k"
          type="button"
          class="chip num-chip"
          :class="{ hurt: k > 0 }"
          :aria-pressed="s.kneePain === k"
          @click="patch({ kneePain: s.kneePain === k ? null : k })"
        >
          {{ k }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.set {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0;
  border-top: 1px solid var(--line);
}
.set.warmup .title {
  color: var(--ink-2);
}
.top {
  display: flex;
  align-items: center;
  gap: 6px;
}
.title {
  flex: 1;
  font-weight: 700;
}
.mini {
  font-size: 14px;
  padding: 0 10px;
}
.danger {
  color: var(--alarm-ink);
  background: transparent;
}
.row {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 6px;
  align-items: center;
}
.label {
  color: var(--ink-2);
  font-size: 15px;
  font-weight: 700;
}
.rir {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 4px;
}
.knee {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 4px;
}
.num-chip {
  padding: 0;
  min-width: 0;
  font-family: var(--font-num);
  font-size: 22px;
}
.num-chip.hurt[aria-pressed='true'] {
  background: var(--warn);
  border-color: var(--warn);
  color: var(--bg);
}
.knee-toggle {
  align-self: flex-start;
  padding: 0 4px;
  font-size: 15px;
}
</style>
