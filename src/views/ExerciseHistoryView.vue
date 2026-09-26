<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '../data/instance'
import { useLive } from '../data/live'
import { loadProgress } from '../data/queries'
import { formatShortDate } from '../domain/dates'
import { formatExerciseLine, formatNumber } from '../domain/format'
import { exerciseHistory } from '../domain/history'
import { e1rmSeries } from '../domain/progress'

const props = defineProps<{ id: string }>()
const router = useRouter()
const { data } = useLive(() => loadProgress(db))

const exercises = computed(() => new Map((data.value?.exercises ?? []).map((e) => [e.id, e])))
const exercise = computed(() => exercises.value.get(props.id) ?? null)

const entries = computed(() => {
  const d = data.value
  const ex = exercise.value
  if (!d || !ex) return []
  const best = new Map(e1rmSeries(ex, d.workouts, d.workoutExercises, d.sets, d.measurements).map((p) => [p.workoutId, p.value]))
  return exerciseHistory(ex.id, d.workouts, d.workoutExercises, d.sets).map((e) => ({
    ...e,
    line: formatExerciseLine('', ex, e.sets).replace(/^\s*:?\s*/, ''),
    insteadOf: e.workoutExercise.plannedExerciseId !== ex.id ? exercises.value.get(e.workoutExercise.plannedExerciseId)?.name : null,
    e1rm: best.get(e.workout.id) ?? null,
  }))
})

function back() {
  if (window.history.length > 1) router.back()
  else void router.push('/historial')
}
</script>

<template>
  <div class="stack">
    <header class="head">
      <button type="button" class="btn btn-quiet back" @click="back">‹ Volver</button>
      <h1>{{ exercise?.name ?? 'Ejercicio' }}</h1>
      <p v-if="entries.length" class="muted small">{{ entries.length === 1 ? '1 sesión' : `${entries.length} sesiones` }}</p>
    </header>

    <div v-if="data && !exercise" class="card">
      <p class="muted">Este ejercicio no está en el catálogo.</p>
    </div>
    <div v-else-if="data && entries.length === 0" class="card">
      <p class="muted">Aún no has hecho este ejercicio. Cuando registres series, aparecerán aquí.</p>
    </div>

    <ul v-else-if="entries.length" class="list">
      <li v-for="e in entries" :key="e.workoutExercise.id">
        <RouterLink :to="`/sesion/${e.workout.id}`" class="row">
          <span class="date">{{ formatShortDate(e.workout.date) }}</span>
          <span class="what">
            <strong>{{ e.line }}</strong>
            <span class="muted small">
              Sesión {{ e.workout.dayKey }}<template v-if="e.insteadOf"> · en lugar de {{ e.insteadOf }}</template
              ><template v-if="e.e1rm !== null"> · 1RM est. {{ formatNumber(e.e1rm) }} kg</template>
            </span>
            <span v-if="e.workoutExercise.notes" class="muted small">Nota: {{ e.workoutExercise.notes }}</span>
          </span>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.head {
  padding: 0 0 4px;
}
.back {
  padding: 0 4px;
  margin-left: -4px;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
}
.list li + li {
  border-top: 1px solid var(--line);
}
.row {
  display: flex;
  gap: 12px;
  min-height: 64px;
  padding: 10px 16px;
  color: inherit;
  text-decoration: none;
}
.date {
  font-family: var(--font-num);
  font-weight: 600;
  font-size: 20px;
  width: 92px;
  flex: none;
}
.what {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
</style>
