<script setup lang="ts">
import { db } from '../data/instance'
import { useLive } from '../data/live'
import { loadHistory } from '../data/queries'
import { formatShortDate } from '../domain/dates'

const { data: rows } = useLive(() => loadHistory(db))

function seriesText(n: number): string {
  return n === 1 ? '1 serie' : `${n} series`
}
</script>

<template>
  <div class="stack">
    <header class="head"><h1>Historial</h1></header>

    <div v-if="rows && rows.length === 0" class="card stack">
      <h2>Aún no hay sesiones</h2>
      <p class="muted">Empieza una desde Hoy y aparecerá aquí.</p>
      <RouterLink to="/" class="btn">Ir a Hoy</RouterLink>
    </div>

    <ul v-else-if="rows" class="list">
      <li v-for="r in rows" :key="r.workout.id">
        <RouterLink :to="`/sesion/${r.workout.id}`" class="row">
          <span class="date">{{ formatShortDate(r.workout.date) }}</span>
          <span class="what">
            <strong>Sesión {{ r.workout.dayKey }}</strong>
            <span class="muted small">{{ r.routineName }} · semana {{ r.workout.weekNumber }} · {{ seriesText(r.setCount) }}</span>
          </span>
          <span v-if="!r.workout.finishedAt" class="badge">Sin terminar</span>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.head {
  padding: 8px 0 4px;
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
  align-items: center;
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
}
.badge {
  font-size: 13px;
  font-weight: 700;
  background: var(--warn-soft);
  color: var(--warn-ink);
  border-radius: 999px;
  padding: 4px 10px;
}
</style>
