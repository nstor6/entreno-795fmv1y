<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import BadgeIcon from '../components/BadgeIcon.vue'
import { db } from '../data/instance'
import { useLive } from '../data/live'
import { loadGame } from '../data/queries'
import { formatShortDate, localDate } from '../domain/dates'
import { POINTS } from '../domain/gamification'

const router = useRouter()
const { data: game } = useLive(() => loadGame(db, localDate()))

const earned = computed(() => game.value?.badges.filter((b) => b.earnedOn) ?? [])
const progress = computed(() => {
  const g = game.value
  if (!g) return 0
  return Math.min(100, Math.round(((g.points.total - g.level.from) / (g.level.to - g.level.from)) * 100))
})

function back() {
  if (window.history.length > 1) router.back()
  else void router.push('/')
}
</script>

<template>
  <div class="stack">
    <header class="head">
      <button type="button" class="btn btn-quiet back" @click="back">‹ Volver</button>
      <h1>Logros</h1>
    </header>

    <div v-if="game === null" class="card stack">
      <p class="muted">Importa una rutina para empezar a sumar.</p>
      <RouterLink to="/datos" class="btn">Ir a Datos</RouterLink>
    </div>

    <template v-else-if="game">
      <section class="card stack" aria-labelledby="level-title">
        <div class="level-row">
          <h2 id="level-title" class="num big">Nivel {{ game.level.level }}</h2>
          <span class="muted small">+{{ game.points.thisWeek }} esta semana</span>
        </div>
        <div class="bar" role="progressbar" :aria-valuenow="game.points.total" :aria-valuemin="game.level.from" :aria-valuemax="game.level.to">
          <span :style="{ width: `${progress}%` }" />
        </div>
        <p class="small muted">{{ game.points.total }} puntos · te faltan {{ game.level.to - game.points.total }} para el nivel {{ game.level.level + 1 }}</p>
      </section>

      <section class="card streak-card" aria-labelledby="streak-title">
        <span class="flame" :class="{ lit: game.streak.current > 0 }"><BadgeIcon icon="flame" :size="44" /></span>
        <div>
          <h2 id="streak-title">
            <span class="num big">{{ game.streak.current }}</span>
            {{ game.streak.current === 1 ? 'semana seguida' : 'semanas seguidas' }}
          </h2>
          <p class="small muted">
            Esta semana: {{ game.streak.thisWeek.sessions }} de {{ game.streak.thisWeek.target }} sesiones · mejor racha:
            {{ game.streak.best }}
          </p>
        </div>
      </section>

      <section class="stack" aria-labelledby="badges-title">
        <h2 id="badges-title">Insignias · {{ earned.length }} de {{ game.badges.length }}</h2>
        <ul class="badges">
          <li v-for="b in game.badges" :key="b.id" class="badge" :class="{ earned: b.earnedOn }">
            <span class="icon"><BadgeIcon :icon="b.icon" :size="26" /></span>
            <strong>{{ b.name }}</strong>
            <span class="small muted">{{ b.earnedOn ? formatShortDate(b.earnedOn) : b.description }}</span>
          </li>
        </ul>
      </section>

      <details class="card">
        <summary class="how">Cómo se ganan los puntos</summary>
        <ul class="rules small">
          <li>Sesión con al menos una serie: {{ POINTS.session }}</li>
          <li>Cada ejercicio con todas las series del plan: +{{ POINTS.exerciseDone }}</li>
          <li>Sesión completa: +{{ POINTS.fullSession }}</li>
          <li>Día con el diario rellenado: {{ POINTS.diaryDay }}</li>
          <li>Medirte (una vez por semana): {{ POINTS.measurementWeek }}</li>
          <li>Semana cumplida: +{{ POINTS.weekDone }}</li>
        </ul>
        <p class="small muted">Las series de más no suman: lo que cuenta es cumplir el plan. La semana en que empieza una rutina no rompe la racha.</p>
      </details>
    </template>
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
.big {
  font-size: 34px;
}
.level-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.bar {
  height: 12px;
  border-radius: 6px;
  background: var(--surface-2);
  overflow: hidden;
}
.bar span {
  display: block;
  height: 100%;
  background: var(--action);
  border-radius: 6px;
}
.streak-card {
  display: flex;
  align-items: center;
  gap: 16px;
}
.flame {
  color: var(--ink-2);
  display: flex;
}
.flame.lit {
  color: var(--warn);
}
.badges {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.badge {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border-radius: var(--radius);
  border: 1px solid var(--line);
  background: var(--surface);
}
.badge .icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
  color: var(--ink-2);
}
.badge:not(.earned) strong {
  color: var(--ink-2);
}
.badge.earned {
  border-color: var(--action);
}
.badge.earned .icon {
  background: var(--action);
  color: var(--on-action);
}
.how {
  font-weight: 700;
  min-height: 32px;
  cursor: pointer;
}
.rules {
  margin: 8px 0;
  padding-left: 18px;
}
</style>
