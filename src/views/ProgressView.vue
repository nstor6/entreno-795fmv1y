<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ChartPanel from '../components/ChartPanel.vue'
import MeasurementsPanel from '../components/MeasurementsPanel.vue'
import { db } from '../data/instance'
import { useLive } from '../data/live'
import { loadProgress } from '../data/queries'
import { readLocal, writeLocal } from '../data/storage'
import { addDays, formatShortDate, localDate, monthShort } from '../domain/dates'
import { formatNumber } from '../domain/format'
import { e1rmSeries, exercisesWithSets, measurementSeries, sleepKneeByDay } from '../domain/progress'
import { isAlive } from '../domain/types'

const { data } = useLive(() => loadProgress(db))
const today = localDate()
const short = (d: string) => `${Number(d.slice(8, 10))} ${monthShort(d)}`

// Time range: one filter row above every chart.
type Range = '4w' | '3m' | 'all'
const RANGES: { value: Range; label: string }[] = [
  { value: '4w', label: '4 semanas' },
  { value: '3m', label: '3 meses' },
  { value: 'all', label: 'Todo' },
]
const range = ref<Range>((readLocal('entreno:progress-range') as Range | null) ?? '3m')
watch(range, (r) => writeLocal('entreno:progress-range', r))
const fromDate = computed(() => (range.value === '4w' ? addDays(today, -27) : range.value === '3m' ? addDays(today, -90) : null))
const inRange = (date: string) => fromDate.value === null || date >= fromDate.value

// e1RM per exercise
const choices = computed(() => (data.value ? exercisesWithSets(data.value.exercises, data.value.sets) : []))
const exerciseId = ref<string | null>(readLocal('entreno:progress-exercise'))
watch(
  choices,
  (list) => {
    if (list.length && !list.some((e) => e.id === exerciseId.value)) exerciseId.value = list[0]!.id
  },
  { immediate: true },
)
watch(exerciseId, (id) => writeLocal('entreno:progress-exercise', id))
const exercise = computed(() => choices.value.find((e) => e.id === exerciseId.value) ?? null)
const e1rmPoints = computed(() => {
  const d = data.value
  if (!d || !exercise.value) return []
  return e1rmSeries(exercise.value, d.workouts, d.workoutExercises, d.sets, d.measurements).filter((p) => inRange(p.date))
})
function setText(i: number): string {
  const p = e1rmPoints.value[i]!
  const s = p.set
  const rir = s.rir === null ? '' : ` · RIR ${s.rir === 5 ? '5+' : s.rir}`
  const load = exercise.value?.bodyweight
    ? `${formatNumber(p.loadKg - (s.loadKg ?? 0))} kg + ${formatNumber(s.loadKg ?? 0)} kg de lastre`
    : `${formatNumber(p.loadKg)} kg`
  return `${load} × ${s.reps}${rir}`
}

// Weight and waist: two panels sharing the dates, each with its own axis.
const body = computed(() => {
  const m = data.value ? measurementSeries(data.value.measurements) : { weight: [], waist: [] }
  const dates = [...new Set([...m.weight, ...m.waist].map((p) => p.date))].filter(inRange).sort()
  const at = (pts: { date: string; value: number }[]) => dates.map((d) => pts.find((p) => p.date === d)?.value ?? null)
  return { dates, weight: at(m.weight), waist: at(m.waist) }
})
const bodyTooltip = (i: number) => {
  const w = body.value.weight[i]
  const c = body.value.waist[i]
  return [w != null ? `Peso ${formatNumber(w)} kg` : 'Peso —', c != null ? `Cintura ${formatNumber(c)} cm` : 'Cintura —']
}

// Sleep and knee per day
const days = computed(() => {
  const d = data.value
  if (!d) return []
  // Start at the first day with data inside the range, so a short history isn't squeezed to the right.
  const dataDates = [...d.dailyLogs.filter(isAlive).map((l) => l.date), ...d.workouts.filter(isAlive).map((w) => w.date)]
  const firstData = dataDates.filter(inRange).sort()[0] ?? today
  return sleepKneeByDay(firstData, today, d.dailyLogs, d.workouts, d.workoutExercises, d.sets)
})
const hasDays = computed(() => days.value.some((p) => p.sleepHours !== null || p.knee !== null))
const dayTooltip = (i: number) => {
  const p = days.value[i]!
  return [
    p.sleepHours !== null ? `Sueño ${formatNumber(p.sleepHours)} h` : 'Sueño —',
    p.knee !== null ? `Rodilla ${p.knee}/10` : 'Rodilla —',
  ]
}

const latest = <T,>(xs: T[]) => xs[xs.length - 1]
</script>

<template>
  <div class="stack">
    <header class="head"><h1>Progreso</h1></header>

    <div class="chips-fill" role="group" aria-label="Periodo">
      <button v-for="r in RANGES" :key="r.value" type="button" class="chip" :aria-pressed="range === r.value" @click="range = r.value">
        {{ r.label }}
      </button>
    </div>

    <!-- e1RM -->
    <section class="card stack" aria-labelledby="e1rm-title">
      <h2 id="e1rm-title">1RM estimado</h2>
      <template v-if="choices.length">
        <label class="visually-hidden" for="e1rm-exercise">Ejercicio</label>
        <select id="e1rm-exercise" v-model="exerciseId" class="select">
          <option v-for="e in choices" :key="e.id" :value="e.id">{{ e.name }}</option>
        </select>
        <template v-if="e1rmPoints.length">
          <p class="figure">
            <span class="num">{{ formatNumber(latest(e1rmPoints)!.value) }} kg</span>
            <span class="muted small">último · {{ formatShortDate(latest(e1rmPoints)!.date) }}</span>
          </p>
          <ChartPanel
            type="line"
            :label="`1RM estimado de ${exercise?.name} por sesión`"
            :labels="e1rmPoints.map((p) => short(p.date))"
            :values="e1rmPoints.map((p) => p.value)"
            :tooltip-title="(i) => formatShortDate(e1rmPoints[i]!.date)"
            :tooltip-lines="(i) => [`${formatNumber(e1rmPoints[i]!.value)} kg estimado`, setText(i)]"
          />
          <p class="muted small">Es una estimación: sirve para ver la tendencia, no como marca real.</p>
          <details>
            <summary class="muted small">Ver datos</summary>
            <table class="data">
              <thead><tr><th>Fecha</th><th>1RM est.</th><th>Mejor serie</th></tr></thead>
              <tbody>
                <tr v-for="(p, i) in e1rmPoints" :key="p.workoutId">
                  <td>{{ formatShortDate(p.date) }}</td>
                  <td>{{ formatNumber(p.value) }} kg</td>
                  <td>{{ setText(i) }}</td>
                </tr>
              </tbody>
            </table>
          </details>
        </template>
        <p v-else-if="exercise?.bodyweight" class="muted">Apunta tu peso abajo, en Medidas, para calcularlo: aquí la carga es tu peso más el lastre.</p>
        <p v-else class="muted">No hay series de este ejercicio en este periodo.</p>
      </template>
      <p v-else class="muted">Cuando registres series, aquí verás tu 1RM estimado por ejercicio.</p>
    </section>

    <!-- Weight and waist -->
    <section class="card stack" aria-labelledby="body-title">
      <h2 id="body-title">Peso y cintura</h2>
      <template v-if="body.dates.length">
        <p class="panel-title small"><strong>Peso</strong> <span class="muted">kg</span></p>
        <ChartPanel
          type="line"
          label="Peso por fecha"
          :labels="body.dates.map(short)"
          :values="body.weight"
          :height="140"
          :show-x-labels="false"
          :tooltip-title="(i) => formatShortDate(body.dates[i]!)"
          :tooltip-lines="bodyTooltip"
        />
        <p class="panel-title small"><strong>Cintura</strong> <span class="muted">cm</span></p>
        <ChartPanel
          type="line"
          label="Cintura por fecha"
          :labels="body.dates.map(short)"
          :values="body.waist"
          :height="150"
          :tooltip-title="(i) => formatShortDate(body.dates[i]!)"
          :tooltip-lines="bodyTooltip"
        />
      </template>
      <p v-else class="muted">Apunta tu peso y tu cintura abajo para ver cómo cambian.</p>
    </section>

    <!-- Sleep and knee -->
    <section class="card stack" aria-labelledby="sleep-title">
      <h2 id="sleep-title">Sueño y rodilla</h2>
      <template v-if="hasDays">
        <p class="panel-title small"><strong>Sueño</strong> <span class="muted">horas</span></p>
        <ChartPanel
          type="bar"
          label="Horas de sueño por día"
          :labels="days.map((p) => short(p.date))"
          :values="days.map((p) => p.sleepHours)"
          :y-min="0"
          :height="140"
          :show-x-labels="false"
          :tooltip-title="(i) => formatShortDate(days[i]!.date)"
          :tooltip-lines="dayTooltip"
        />
        <p class="panel-title small"><strong>Rodilla</strong> <span class="muted">0-10</span></p>
        <ChartPanel
          type="line"
          color="warn"
          label="Molestia de rodilla por día, de 0 a 10"
          :labels="days.map((p) => short(p.date))"
          :values="days.map((p) => p.knee)"
          :y-min="0"
          :y-max="10"
          :height="150"
          :tooltip-title="(i) => formatShortDate(days[i]!.date)"
          :tooltip-lines="dayTooltip"
        />
      </template>
      <p v-else class="muted">Rellena «Tu día» en Hoy y aquí verás tu sueño y tu rodilla.</p>
    </section>

    <h2 class="section-title">Medidas</h2>
    <MeasurementsPanel />
  </div>
</template>

<style scoped>
.head {
  padding: 8px 0 4px;
}
.select {
  width: 100%;
  min-height: var(--tap);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--surface);
  padding: 0 12px;
  font-weight: 700;
}
.figure {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.figure .num {
  font-size: 34px;
}
.panel-title {
  margin-bottom: -6px;
}
.data {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
  font-size: 14px;
}
.data th,
.data td {
  text-align: left;
  padding: 6px 4px;
  border-bottom: 1px solid var(--line);
}
.data th {
  color: var(--ink-2);
  font-weight: 700;
}
.section-title {
  margin-top: 8px;
}
</style>
