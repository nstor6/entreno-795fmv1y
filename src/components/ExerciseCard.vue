<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { db } from '../data/instance'
import type { SessionExercise } from '../data/queries'
import { addSet, deleteSet, updateWorkoutExercise } from '../data/session'
import { readLocal, writeLocal } from '../data/storage'
import { formatShortDate } from '../domain/dates'
import { formatExerciseLine, formatTarget } from '../domain/format'
import { lastAny, lastWorkingSetAs, workingSetsByExercise } from '../domain/history'
import { draftSet } from '../domain/setDraft'
import type { AltReason, Exercise } from '../domain/types'
import SetRow from './SetRow.vue'

const props = defineProps<{ item: SessionExercise; exercises: Map<string, Exercise> }>()

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

async function onAdd() {
  const ex = active.value
  if (!ex) return
  const lastTime = lastWorkingSetAs(props.item.records, ex.id)
  const targetMin = we.value.targetMin
  await addSet(db, we.value.id, ex.id, (previous) => draftSet(ex, targetMin, previous, lastTime))
}

function removeSet(id: string) {
  void deleteSet(db, id)
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

    <div v-if="alternatives.length" class="alt">
      <button type="button" class="btn btn-quiet alt-toggle" :aria-expanded="altOpen" @click="altOpen = !altOpen">
        Alternativa
      </button>
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
      />
    </div>

    <button type="button" class="btn btn-primary btn-block" @click="onAdd">Añadir serie</button>

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
.last {
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
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
