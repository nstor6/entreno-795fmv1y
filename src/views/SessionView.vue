<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ExerciseCard from '../components/ExerciseCard.vue'
import FocusRow from '../components/FocusRow.vue'
import RestBar from '../components/RestBar.vue'
import SessionRecords from '../components/SessionRecords.vue'
import { db } from '../data/instance'
import { useLive } from '../data/live'
import { loadSession, type SessionExercise } from '../data/queries'
import { deleteWorkout, finishWorkout, reopenWorkout, restoreWorkout, updateWorkout } from '../data/session'
import { showToast } from '../ui/toast'
import { useRouter } from 'vue-router'
import { readLocal, writeLocal } from '../data/storage'
import { formatShortDate } from '../domain/dates'
import { formatWorkoutExerciseLines } from '../domain/format'
import { afterSet, finishedSets, firstPending, nextPendingAfter, type FocusItem, type SetLogged } from '../domain/focus'
import type { RestRequest, RunningRest } from '../domain/rest'
import { weekLabel } from '../domain/weeks'

const props = defineProps<{ id: string }>()
const router = useRouter()
const { data: model } = useLive(() => loadSession(db, props.id))

const finished = computed(() => model.value?.workout.finishedAt != null)
const label = computed(() => (model.value?.routine ? weekLabel(model.value.routine.weekOverrides, model.value.workout.weekNumber) : null))

// Exercises of the same superset are shown together.
const groups = computed(() => {
  const out: { key: string; superset: boolean; items: SessionExercise[] }[] = []
  for (const item of model.value?.items ?? []) {
    const g = item.workoutExercise.supersetGroup
    const prev = out[out.length - 1]
    if (g && prev?.superset && prev.key === g) prev.items.push(item)
    else out.push({ key: g ?? item.workoutExercise.id, superset: g !== null, items: [item] })
  }
  return out
})

// Warm-up checklist: per-device convenience, not training data.
const warmupKey = computed(() => `entreno:warmup:${props.id}`)
const warmupDone = ref<number[]>(JSON.parse(readLocal(warmupKey.value) ?? '[]') as number[])
function toggleWarmup(i: number) {
  warmupDone.value = warmupDone.value.includes(i) ? warmupDone.value.filter((x) => x !== i) : [...warmupDone.value, i]
  writeLocal(warmupKey.value, JSON.stringify(warmupDone.value))
}

const summary = computed(() => {
  const m = model.value
  if (!m) return []
  return m.items.flatMap((item) =>
    item.planned ? formatWorkoutExerciseLines(item.planned, m.exercises, item.sets, item.workoutExercise.notes) : [],
  )
})

const duration = computed(() => {
  const w = model.value?.workout
  if (!w?.finishedAt) return null
  const min = Math.round((Date.parse(w.finishedAt) - Date.parse(w.startedAt)) / 60000)
  return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`
})

const confirmingFinish = ref(false)
async function finish() {
  if (!confirmingFinish.value) {
    confirmingFinish.value = true
    return
  }
  confirmingFinish.value = false
  await finishWorkout(db, props.id)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
async function reopen() {
  await reopenWorkout(db, props.id)
}

// Delete the whole session (e.g. started by mistake), with undo.
const confirmingDelete = ref(false)
async function removeSession() {
  if (!confirmingDelete.value) {
    confirmingDelete.value = true
    return
  }
  const id = props.id
  const deletedAt = await deleteWorkout(db, id)
  await router.push('/')
  showToast('Sesión borrada.', { label: 'Deshacer', run: () => restoreWorkout(db, id, deletedAt) })
}

// Rest timer: one at a time, kept on this device so a reload doesn't lose it.
const restKey = computed(() => `entreno:rest:${props.id}`)
const rest = ref<RunningRest | null>(JSON.parse(readLocal(restKey.value) ?? 'null') as RunningRest | null)
function startRest(r: RestRequest) {
  rest.value = { ...r, startedAt: Date.now() }
  writeLocal(restKey.value, JSON.stringify(rest.value))
}
function stopRest() {
  rest.value = null
  writeLocal(restKey.value, null)
}
watch(finished, (f) => f && stopRest())

// Focus mode: one exercise open at a time while the session is live. The open one is
// kept on this device; with none stored, the first exercise with sets left.
const FOCUS_MODE_KEY = 'entreno:focus-mode'
const focusModeOn = ref(readLocal(FOCUS_MODE_KEY) !== 'off')
function setFocusMode(on: boolean) {
  focusModeOn.value = on
  writeLocal(FOCUS_MODE_KEY, on ? null : 'off')
}
const focusMode = computed(() => focusModeOn.value && !finished.value)

const focusKey = computed(() => `entreno:focus:${props.id}`)
const storedFocus = ref<{ id: string | null } | null>(JSON.parse(readLocal(focusKey.value) ?? 'null'))
const focusItems = computed<FocusItem[]>(() =>
  (model.value?.items ?? []).map((i) => ({
    id: i.workoutExercise.id,
    supersetGroup: i.workoutExercise.supersetGroup,
    targetSets: i.workoutExercise.targetSets,
    doneSets: finishedSets(i.sets, i.workoutExercise.rirMin !== null),
  })),
)
const openId = computed(() => {
  const stored = storedFocus.value
  if (stored && (stored.id === null || focusItems.value.some((x) => x.id === stored.id))) return stored.id
  return firstPending(focusItems.value)
})
const allDone = computed(() => focusItems.value.length > 0 && firstPending(focusItems.value) === null)
const isOpen = (item: SessionExercise) => !focusMode.value || item.workoutExercise.id === openId.value

async function focusOn(id: string | null, scroll = true) {
  storedFocus.value = { id }
  writeLocal(focusKey.value, JSON.stringify({ id }))
  if (!scroll || !id || !focusMode.value) return
  await nextTick()
  document.getElementById(`ex-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const nextName = computed(() => {
  const id = openId.value && nextPendingAfter(focusItems.value, openId.value)
  return id ? { id, name: model.value?.items.find((i) => i.workoutExercise.id === id)?.planned?.name ?? '' } : null
})

// A set was just finished: rest or not, and which exercise to open (supersets alternate).
function onLogged(e: SetLogged) {
  const items = focusItems.value.map((x) => (x.id === e.workoutExerciseId ? { ...x, doneSets: Math.max(x.doneSets, e.doneSets) } : x))
  const next = afterSet(items, e.workoutExerciseId)
  if (next.rest && e.rest) startRest(e.rest)
  if (next.focus !== openId.value) void focusOn(next.focus)
}

// Session note
const note = ref('')
watch(
  () => model.value?.workout.notes,
  (v) => {
    if (v !== undefined && document.activeElement?.id !== 'session-note') note.value = v
  },
  { immediate: true },
)
function saveNote() {
  if (model.value && note.value !== model.value.workout.notes) void updateWorkout(db, props.id, { notes: note.value })
}

// Keep the screen on during an unfinished session, when the browser allows it.
let wakeLock: WakeLockSentinel | null = null
async function lockScreen() {
  if (finished.value || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return
  try {
    wakeLock = await navigator.wakeLock.request('screen')
  } catch {
    wakeLock = null
  }
}
function releaseScreen() {
  void wakeLock?.release()
  wakeLock = null
}
const onVisibility = () => void (document.visibilityState === 'visible' ? lockScreen() : undefined)
onMounted(() => {
  void lockScreen()
  document.addEventListener('visibilitychange', onVisibility)
})
watch(finished, (f) => (f ? releaseScreen() : void lockScreen()))
onBeforeUnmount(() => {
  saveNote()
  releaseScreen()
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <div v-if="model === null" class="card stack">
    <h2>Esta sesión no existe</h2>
    <p class="muted">Puede que se borrara o que el enlace sea de otro móvil.</p>
    <RouterLink to="/" class="btn">Volver a Hoy</RouterLink>
  </div>

  <div v-else-if="model" class="stack">
    <header class="head">
      <p class="muted small">
        {{ formatShortDate(model.workout.date) }} · {{ model.routine?.shortName }} · semana {{ model.workout.weekNumber }}
      </p>
      <h1>{{ model.day?.name ?? `Sesión ${model.workout.dayKey}` }}</h1>
    </header>

    <section v-if="finished" class="card stack done" aria-label="Resumen de la sesión">
      <h2>Sesión terminada<template v-if="duration"> · {{ duration }}</template></h2>
      <SessionRecords :workout-id="model.workout.id" />
      <ul class="lines">
        <li v-for="(l, i) in summary" :key="i">{{ l }}</li>
      </ul>
      <RouterLink to="/" class="btn btn-primary">Volver a Hoy</RouterLink>
      <button type="button" class="btn btn-quiet" @click="reopen">Reabrir sesión</button>
    </section>

    <p v-if="label && !finished" class="notice notice-info">{{ label }}</p>

    <details v-if="model.routine?.warmup.length && !finished" class="card warmup">
      <summary class="warmup-title">Calentamiento · {{ warmupDone.length }}/{{ model.routine.warmup.length }}</summary>
      <ul class="checklist">
        <li v-for="(w, i) in model.routine.warmup" :key="i">
          <label>
            <input type="checkbox" :checked="warmupDone.includes(i)" @change="toggleWarmup(i)" />
            <span>{{ w }}</span>
          </label>
        </li>
      </ul>
    </details>

    <div v-if="!finished" class="view-toggle">
      <button type="button" class="btn btn-quiet" @click="setFocusMode(!focusModeOn)">
        {{ focusModeOn ? 'Ver todos los ejercicios' : 'Ver un ejercicio a la vez' }}
      </button>
    </div>

    <div v-if="focusMode && allDone && openId === null" class="notice notice-info all-done" role="status">
      Has hecho todas las series. Revisa lo que quieras y pulsa «Terminar sesión».
    </div>

    <template v-for="g in groups" :key="g.key">
      <section v-if="g.superset" class="superset" aria-label="Superserie">
        <p class="superset-label">Superserie · alterna los dos y descansa después del par</p>
        <template v-for="item in g.items" :key="item.workoutExercise.id">
          <div :id="`ex-${item.workoutExercise.id}`" class="anchor">
            <ExerciseCard
              v-if="isOpen(item)"
              :item="item"
              :exercises="model.exercises"
              :sleep-quality="model.sleepQuality"
              :live="!finished"
              @rest="startRest"
              @logged="onLogged"
            />
            <FocusRow v-else :item="item" :exercises="model.exercises" @open="focusOn(item.workoutExercise.id)" />
          </div>
        </template>
        <button
          v-if="focusMode && nextName && g.items.some((i) => i.workoutExercise.id === openId)"
          type="button"
          class="btn next"
          @click="focusOn(nextName.id)"
        >
          Siguiente: {{ nextName.name }} ›
        </button>
      </section>
      <div v-else :id="`ex-${g.items[0]!.workoutExercise.id}`" class="anchor stack-tight">
        <ExerciseCard
          v-if="isOpen(g.items[0]!)"
          :item="g.items[0]!"
          :exercises="model.exercises"
          :sleep-quality="model.sleepQuality"
          :live="!finished"
          @rest="startRest"
          @logged="onLogged"
        />
        <FocusRow v-else :item="g.items[0]!" :exercises="model.exercises" @open="focusOn(g.items[0]!.workoutExercise.id)" />
        <button
          v-if="focusMode && nextName && openId === g.items[0]!.workoutExercise.id"
          type="button"
          class="btn next"
          @click="focusOn(nextName.id)"
        >
          Siguiente: {{ nextName.name }} ›
        </button>
      </div>
    </template>

    <div class="card">
      <label class="field-label" for="session-note">Nota de la sesión</label>
      <textarea id="session-note" v-model="note" rows="2" @blur="saveNote" />
    </div>

    <template v-if="!finished">
      <button type="button" class="btn btn-block finish" :class="{ confirm: confirmingFinish }" @click="finish">
        {{ confirmingFinish ? 'Toca otra vez para terminar' : 'Terminar sesión' }}
      </button>
      <button v-if="confirmingFinish" type="button" class="btn btn-quiet" @click="confirmingFinish = false">Seguir entrenando</button>
    </template>

    <button type="button" class="btn btn-danger remove" @click="removeSession">
      {{ confirmingDelete ? 'Toca otra vez para borrarla entera' : finished ? 'Borrar sesión' : 'Descartar sesión' }}
    </button>
    <button v-if="confirmingDelete" type="button" class="btn btn-quiet" @click="confirmingDelete = false">No borrar</button>

    <RestBar v-if="rest && !finished" :key="rest.startedAt" v-bind="rest" @stop="stopRest" />
  </div>
</template>

<style scoped>
.head {
  padding: 8px 0 4px;
}
.warmup-title {
  font-weight: 700;
  min-height: 32px;
  cursor: pointer;
}
.checklist {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.checklist label {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  min-height: var(--tap);
  padding: 8px 0;
}
.checklist input {
  width: 24px;
  height: 24px;
  flex: none;
  accent-color: var(--action);
}
.checklist input:checked + span {
  color: var(--ink-2);
  text-decoration: line-through;
}
.superset {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-left: 4px solid var(--action);
  padding-left: 8px;
  margin-left: -12px;
}
.superset-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--action-ink);
}
.lines {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.done {
  border-color: var(--action);
}
.finish {
  min-height: 56px;
  font-size: 18px;
  border: 2px solid var(--ink);
}
.finish.confirm {
  background: var(--ink);
  color: var(--bg);
}
.remove {
  margin-top: 16px;
}
.view-toggle {
  display: flex;
  justify-content: flex-end;
  margin: -4px 0 -8px;
}
.view-toggle .btn {
  padding: 0 4px;
  font-size: 15px;
}
.anchor {
  scroll-margin-top: 12px;
}
.stack-tight {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.next {
  justify-content: space-between;
  color: var(--action-ink);
}
</style>
