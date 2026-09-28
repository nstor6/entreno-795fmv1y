<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { db } from '../data/instance'
import { updateSet, type SetPatch } from '../data/session'
import { platesPerSide, platesText } from '../domain/plates'
import { plateSettings, platesShownFor } from '../ui/plateSettings'
import { loadStep, stepValue, valueStep } from '../domain/setDraft'
import type { Exercise, SetLog } from '../domain/types'
import NumberStepper from './NumberStepper.vue'

const props = defineProps<{ set: SetLog; index: number; exercise: Exercise; altName: string | null }>()
// done: an RIR was just logged, i.e. the set was finished (starts the rest timer).
const emit = defineEmits<{ remove: []; done: [] }>()

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

function setRir(r: number) {
  const before = s.rir
  const next = before === r ? null : r
  patch({ rir: next })
  // Only the first RIR of a working set means «set finished»; correcting it later doesn't.
  if (before === null && next !== null && !s.isWarmup) emit('done')
}

function value(): number | null {
  return s[valueKey[props.exercise.measure]]
}
function setValue(v: number | null) {
  patch({ [valueKey[props.exercise.measure]]: v })
}

const kneeOpen = ref(props.set.kneePain !== null)

// Plates per side, when switched on for this exercise in its card.
const plates = computed(() => {
  if (props.exercise.bodyweight || s.loadKg === null || !platesShownFor(props.exercise.id)) return null
  const { barKg, plates: available } = plateSettings.value
  return platesText(platesPerSide(s.loadKg, barKg, available), barKg)
})

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
      <button type="button" class="chip mini danger" @click="emit('remove')">Borrar</button>
    </div>

    <NumberStepper
      :value="s.loadKg"
      :step="loadStep(exercise)"
      :label="exercise.bodyweight ? 'lastre' : 'kg'"
      placeholder="sin carga"
      @change="(v) => patch({ loadKg: v })"
      @step="(d) => patch({ loadKg: stepValue(s.loadKg, d) })"
    />
    <p v-if="plates" class="plates small">{{ plates }}</p>
    <NumberStepper
      :value="value()"
      :step="valueStep(exercise.measure)"
      :label="valueLabel[exercise.measure]"
      integer
      @change="setValue"
      @step="(d) => setValue(stepValue(value(), d))"
    />

    <div class="field-row">
      <span class="label">RIR</span>
      <div class="grid-6" role="group" aria-label="RIR">
        <button
          v-for="r in RIRS"
          :key="r"
          type="button"
          class="chip num-chip"
          :aria-pressed="s.rir === r"
          @click="setRir(r)"
        >
          {{ r === 5 ? '5+' : r }}
        </button>
      </div>
    </div>

    <button v-if="!kneeOpen" type="button" class="btn btn-quiet knee-toggle" @click="kneeOpen = true">Anotar rodilla</button>
    <div v-else class="field-row">
      <span class="label">Rodilla</span>
      <div class="grid-6" role="group" aria-label="Rodilla de 0 a 10">
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
.plates {
  margin: -4px 0 0 70px;
  color: var(--ink-2);
  font-weight: 700;
}
.knee-toggle {
  align-self: flex-start;
  padding: 0 4px;
  font-size: 15px;
}
</style>
