<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '../data/instance'
import { useLive } from '../data/live'
import { loadGame, loadToday } from '../data/queries'
import { finishForgottenWorkout, reopenWorkout, startWorkout } from '../data/session'
import { showToast } from '../ui/toast'
import { formatShortDate, localDate } from '../domain/dates'
import { REST_WARNING } from '../domain/nextSession'
import { kneeMessages } from '../domain/knee'
import BackupNotice from '../components/BackupNotice.vue'
import DiaryCard from '../components/DiaryCard.vue'
import GameCard from '../components/GameCard.vue'

const router = useRouter()
const today = localDate()
const { data: model } = useLive(() => loadToday(db, today))
const { data: game } = useLive(() => loadGame(db, today))

// Follows the next session until you pick another one by hand.
const manualDayId = ref<string | null>(null)
const chosenDayId = computed(() => manualDayId.value ?? model.value?.nextDay?.id ?? null)
const chosenDay = computed(() => model.value?.days.find((d) => d.id === chosenDayId.value) ?? null)

const starting = ref(false)
const error = ref<string | null>(null)

async function finishForgotten() {
  const w = model.value?.unfinished
  if (!w) return
  await finishForgottenWorkout(db, w.id)
  showToast(`Sesión del ${formatShortDate(w.date)} terminada.`, { label: 'Deshacer', run: () => reopenWorkout(db, w.id) })
}

async function start() {
  if (!chosenDay.value || starting.value) return
  starting.value = true
  error.value = null
  try {
    const id = await startWorkout(db, chosenDay.value.id, today)
    await router.push(`/sesion/${id}`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo empezar la sesión. Vuelve a intentarlo.'
  } finally {
    starting.value = false
  }
}
</script>

<template>
  <div v-if="model" class="stack">
    <header class="head">
      <p class="muted small">{{ formatShortDate(today) }}</p>
      <h1 v-if="model.routine">{{ model.routine.shortName }}<template v-if="model.week && model.week > 0"> · semana {{ model.week }}</template></h1>
      <h1 v-else>Hoy</h1>
    </header>

    <p v-for="(m, i) in kneeMessages(model.knee)" :key="i" class="notice" :class="`notice-${m.level}`" role="alert">
      {{ m.text }}
    </p>

    <template v-if="!model.routine">
      <div class="card stack">
        <h2>Importa una rutina para empezar</h2>
        <p class="muted">Carga el archivo JSON de la rutina desde Datos.</p>
        <RouterLink to="/datos" class="btn btn-primary">Ir a Datos</RouterLink>
      </div>
    </template>

    <template v-else>
      <p v-if="model.week !== null && model.week < 1" class="notice notice-info">
        La rutina empieza el {{ formatShortDate(model.routine.startDate) }}.
      </p>
      <p v-if="model.weekLabel" class="notice notice-info">{{ model.weekLabel }}</p>
      <p v-if="model.trainedYesterday && !model.unfinished" class="notice notice-warn">{{ REST_WARNING }}</p>

      <div v-if="model.unfinished && model.unfinished.date < today" class="card stack">
        <p class="muted small">Sesión sin terminar · {{ formatShortDate(model.unfinished.date) }}</p>
        <h2>Sesión {{ model.unfinished.dayKey }}</h2>
        <p class="muted">Parece que se te olvidó terminarla. Termínala para empezar la de hoy.</p>
        <button type="button" class="btn btn-primary" @click="finishForgotten">Terminarla</button>
        <RouterLink :to="`/sesion/${model.unfinished.id}`" class="btn">Continuar sesión</RouterLink>
      </div>

      <div v-else-if="model.unfinished" class="card stack">
        <p class="muted small">Sesión sin terminar · {{ formatShortDate(model.unfinished.date) }}</p>
        <h2>Sesión {{ model.unfinished.dayKey }}</h2>
        <RouterLink :to="`/sesion/${model.unfinished.id}`" class="btn btn-primary">Continuar sesión</RouterLink>
      </div>

      <div v-else class="card stack">
        <p class="muted small">Siguiente sesión</p>
        <h2 v-if="chosenDay">{{ chosenDay.name }}</h2>
        <div class="chips" role="group" aria-label="Elegir sesión">
          <button
            v-for="d in model.days"
            :key="d.id"
            type="button"
            class="chip"
            :aria-pressed="d.id === chosenDayId"
            @click="manualDayId = d.id"
          >
            {{ d.key }}
          </button>
        </div>
        <p v-if="chosenDay && model.nextDay && chosenDay.id !== model.nextDay.id" class="muted small">
          Te toca la {{ model.nextDay.key }}, pero puedes hacer otra.
        </p>
        <button type="button" class="btn btn-primary" :disabled="!chosenDay || starting" @click="start">Empezar sesión</button>
        <p v-if="error" class="notice notice-alarm" role="alert">{{ error }}</p>
      </div>
    </template>

    <GameCard v-if="game" :game="game" />

    <DiaryCard :date="today" :log="model.diary" :last-sleep-hours="model.lastSleepHours" />

    <BackupNotice :has-sessions="model.hasSessions" />

    <details v-if="model.routine?.notes" class="card">
      <summary class="summary">Notas de la rutina</summary>
      <p class="muted" style="margin-top: 8px">{{ model.routine.notes }}</p>
    </details>
  </div>
</template>

<style scoped>
.head {
  padding: 8px 0 4px;
}
.summary {
  font-weight: 700;
  min-height: 32px;
  cursor: pointer;
}
</style>
