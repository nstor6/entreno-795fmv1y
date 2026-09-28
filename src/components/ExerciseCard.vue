<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { db } from '../data/instance'
import type { SessionExercise } from '../data/queries'
import { addSet, deleteSet, restoreSet, updateWorkoutExercise } from '../data/session'
import { tick } from '../ui/haptics'
import { platesShownFor, setPlatesShownFor } from '../ui/plateSettings'
import { showToast } from '../ui/toast'
import { readLocal, writeLocal } from '../data/storage'
import { formatShortDate } from '../domain/dates'
import { formatExerciseLine, formatTarget } from '../domain/format'
import { lastAny, lastWorkingSetAs, workingSetsByExercise } from '../domain/history'
import { suggest, suggestedLoad, suggestionText } from '../domain/progression'
import { finishedSets, type SetLogged } from '../domain/focus'
import type { RestRequest } from '../domain/rest'
import { draftSet } from '../domain/setDraft'
import type { AltReason, Exercise, SleepQuality } from '../domain/types'
import SetRow from './SetRow.vue'

const props = defineProps<{
  item: SessionExercise
  exercises: Map<string, Exercise>
  sleepQuality: SleepQuality | null
  /** Unfinished session: show suggestions. */
  live: boolean
}>()

// rest: the «Descansar» button. logged: a set was just finished — the session decides
// where to go next and whether to rest (supersets alternate without rest).
const emit = defineEmits<{ rest: [request: RestRequest]; logged: [event: SetLogged] }>()

function restRequest(): RestRequest | null {
  const p = props.item.plan
  if (!p) return null
  return { name: active.value?.name ?? planned.value?.name ?? '', minSec: p.restSecMin, maxSec: p.restSecMax }
}

function startRest() {
  const r = restRequest()
  if (props.live && r) emit('rest', r)
}

/** With an RIR target, a set is finished when its RIR is first logged; without one, when it's added. */
const hasRirTarget = computed(() => props.item.workoutExercise.rirMin !== null)

function onSetDone(setId: string) {
  if (!props.live || !hasRirTarget.value) return
  // The RIR was just saved from the set row; count that set even if this card's data
  // hasn't caught up with the database yet.
  const sets = props.item.sets.map((s) => (s.id === setId && s.rir === null ? { ...s, rir: 0 } : s))
  emit('logged', { workoutExerciseId: props.item.workoutExercise.id, doneSets: finishedSets(sets, true), rest: restRequest() })
}

const we = computed(() => props.item.workoutExercise)
const planned = computed(() => props.item.planned)

const REASON: Record<AltReason, string> = { knee: 'rodilla', easier: 'más fácil', equipment: 'material ocupado' }

// Exercise used for the next set: the chosen alternative, else the last set's, else the plan's.
const altKey = computed(() => `entreno:alt:${we.value.id}`)
const chosenId = ref<string | null>(readLocal(altKey.value))
const activeId = computed(
  () => chosenId.value ?? props.item.sets[props.item.sets.length - 1]?.exerciseId ?? we.value.plannedExerciseId,
)
const active = computed(() => props.exercises.get(activeId.value) ?? planned.value)
const alternatives = computed(() =>
  (planned.value?.alternatives ?? [])
    .map((a) => ({ exercise: props.exercises.get(a.exerciseId), reason: a.reason }))
    .filter((a): a is { exercise: Exercise; reason: AltReason } => a.exercise !== undefined),
)
const altOpen = ref(false)

const platesOn = computed(() => (active.value ? platesShownFor(active.value.id) : false))
function togglePlates() {
  if (active.value) setPlatesShownFor(active.value.id, !platesOn.value)
}
function choose(id: string) {
  chosenId.value = id
  writeLocal(altKey.value, id)
  altOpen.value = false
}

const target = computed(() => {
  if (!planned.value) return ''
  const p = props.item.plan
  return formatTarget(
    { sets: we.value.targetSets, targetMin: we.value.targetMin, targetMax: we.value.targetMax, rirMin: we.value.rirMin, rirMax: we.value.rirMax },
    planned.value,
    p ? { minSec: p.restSecMin, maxSec: p.restSecMax } : undefined,
  )
})

// «Última vez» is lastAny (SPEC §9), however it was done.
const last = computed(() => lastAny(props.item.records))
const lastLines = computed(() => {
  const rec = last.value
  if (!rec || !planned.value) return []
  const groups = workingSetsByExercise(rec.sets)
  if (groups.length === 0) return ['no hecho']
  return groups.map(({ exerciseId, sets }) => {
    const done = props.exercises.get(exerciseId) ?? planned.value!
    const line = formatExerciseLine('', done, sets).replace(/^\s*:?\s*/, '')
    return exerciseId === planned.value!.id ? line : `${done.name} · ${line}`
  })
})

// Suggestion (SPEC §9), only while the session is open.
const suggestion = computed(() =>
  props.live && planned.value
    ? suggest({ exercise: planned.value, today: we.value, records: props.item.records, sleepQuality: props.sleepQuality })
    : null,
)
const suggestionMessage = computed(() => {
  if (!suggestion.value || !planned.value) return null
  const names = new Map([...props.exercises].map(([id, e]) => [id, e.name]))
  return suggestionText(suggestion.value, planned.value, names)
})

async function onAdd() {
  const ex = active.value
  if (!ex) return
  tick()
  const lastTime = lastWorkingSetAs(props.item.records, ex.id)
  const targetMin = we.value.targetMin
  // The suggested load only applies when doing the planned exercise, not an alternative.
  const suggested = suggestion.value && ex.id === planned.value?.id ? suggestedLoad(suggestion.value) : null
  const before = finishedSets(props.item.sets, false)
  await addSet(db, we.value.id, ex.id, (previous) => draftSet(ex, targetMin, previous, lastTime, suggested))
  // Without an RIR target there's nothing else to log: adding the set means it's done.
  if (props.live && !hasRirTarget.value) {
    emit('logged', { workoutExerciseId: we.value.id, doneSets: before + 1, rest: restRequest() })
  }
}

async function removeSet(id: string) {
  await deleteSet(db, id)
  showToast('Serie borrada.', { label: 'Deshacer', run: () => restoreSet(db, id) })
}

// Exercise note: saved while typing (debounced) and on blur.
const note = ref(we.value.notes)
watch(
  () => we.value.notes,
  (v) => {
    if (document.activeElement?.id !== `note-${we.value.id}`) note.value = v
  },
)
let noteTimer: ReturnType<typeof setTimeout> | undefined
function saveNoteSoon() {
  clearTimeout(noteTimer)
  noteTimer = setTimeout(saveNote, 500)
}
function saveNote() {
  clearTimeout(noteTimer)
  if (note.value !== we.value.notes) void updateWorkoutExercise(db, we.value.id, { notes: note.value })
}
onBeforeUnmount(saveNote)
</script>

<template>
  <article class="card exercise">
    <header class="stack-sm">
      <h2>{{ active?.name ?? we.plannedExerciseId }}</h2>
      <p v-if="active && planned && active.id !== planned.id" class="muted small">en lugar de {{ planned.name }}</p>
      <p class="target">{{ target }}</p>
      <p v-if="item.plan?.notes" class="muted small">{{ item.plan.notes }}</p>
    </header>

    <div v-if="last" class="last small">
      <span class="muted">Última vez · {{ formatShortDate(last.workout.date) }}</span>
      <p v-for="(l, i) in lastLines" :key="i">{{ l }}</p>
    </div>
    <p v-else class="last small muted">Primera vez con este ejercicio.</p>

    <p
      v-if="suggestionMessage"
      class="notice suggestion"
      :class="suggestion?.kind === 'knee_hold' ? 'notice-warn' : 'notice-info'"
    >
      {{ suggestionMessage }}
    </p>

    <div class="alt">
      <div class="tools">
        <button v-if="alternatives.length" type="button" class="btn btn-quiet alt-toggle" :aria-expanded="altOpen" @click="altOpen = !altOpen">
          Alternativa
        </button>
        <button v-if="active && !active.bodyweight" type="button" class="btn btn-quiet alt-toggle" @click="togglePlates">
          {{ platesOn ? 'Ocultar discos' : 'Ver discos' }}
        </button>
        <RouterLink v-if="active" :to="`/ejercicio/${active.id}`" class="btn btn-quiet alt-toggle">Historial</RouterLink>
      </div>
      <div v-if="altOpen" class="alt-list" role="group" aria-label="Elegir ejercicio">
        <button v-if="planned" type="button" class="chip alt-chip" :aria-pressed="activeId === planned.id" @click="choose(planned.id)">
          {{ planned.name }} <span class="reason">plan</span>
        </button>
        <button
          v-for="a in alternatives"
          :key="a.exercise.id"
          type="button"
          class="chip alt-chip"
          :aria-pressed="activeId === a.exercise.id"
          @click="choose(a.exercise.id)"
        >
          {{ a.exercise.name }} <span class="reason">{{ REASON[a.reason] }}</span>
        </button>
      </div>
    </div>

    <div class="sets">
      <SetRow
        v-for="(s, i) in item.sets"
        :key="s.id"
        :set="s"
        :index="i + 1"
        :exercise="exercises.get(s.exerciseId) ?? active!"
        :alt-name="planned && s.exerciseId !== planned.id ? (exercises.get(s.exerciseId)?.name ?? null) : null"
        @remove="removeSet(s.id)"
        @done="onSetDone(s.id)"
      />
    </div>

    <div class="add-row">
      <button type="button" class="btn btn-primary add" @click="onAdd">Añadir serie</button>
      <button v-if="live && item.plan" type="button" class="btn rest" @click="startRest">Descansar</button>
    </div>

    <div>
      <label class="field-label" :for="`note-${we.id}`">Nota del ejercicio</label>
      <textarea :id="`note-${we.id}`" v-model="note" rows="2" @input="saveNoteSoon" @blur="saveNote" />
    </div>
  </article>
</template>

<style scoped>
.exercise {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.stack-sm {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.target {
  font-weight: 700;
}
.suggestion {
  font-size: 17px;
  font-weight: 700;
}
.add-row {
  display: flex;
  gap: 8px;
}
.add-row .add {
  flex: 1;
}
.add-row .rest {
  min-height: 56px;
}
.last {
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
}
.tools {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
}
.alt-toggle {
  padding: 0 4px;
}
.alt-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.alt-chip {
  text-align: left;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.reason {
  font-weight: 400;
  font-size: 14px;
  opacity: 0.85;
}
.sets:empty {
  display: none;
}
</style>
