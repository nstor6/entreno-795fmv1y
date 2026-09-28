<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { readLocal, writeLocal } from '../data/storage'
import type { GameSummary } from '../domain/gamification'
import { showToast } from '../ui/toast'
import BadgeIcon from './BadgeIcon.vue'

const props = defineProps<{ game: GameSummary }>()
const router = useRouter()

const streak = computed(() => props.game.streak)
const level = computed(() => props.game.level)
const progress = computed(() => {
  const { from, to } = level.value
  return Math.min(100, Math.round(((props.game.points.total - from) / (to - from)) * 100))
})
const dots = computed(() => Array.from({ length: streak.value.thisWeek.target }, (_, i) => i < streak.value.thisWeek.sessions))

// New badges since the last time: one short message, with a way to see them.
const SEEN_KEY = 'entreno:badges-seen'
watch(
  () => props.game.badges.filter((b) => b.earnedOn).map((b) => b.id),
  (earned) => {
    const seen = new Set<string>(JSON.parse(readLocal(SEEN_KEY) ?? '[]') as string[])
    const fresh = props.game.badges.filter((b) => b.earnedOn && !seen.has(b.id))
    if (fresh.length === 0) return
    writeLocal(SEEN_KEY, JSON.stringify(earned))
    const text = fresh.length === 1 ? `Insignia nueva: ${fresh[0]!.name}` : `${fresh.length} insignias nuevas`
    showToast(text, { label: 'Ver', run: () => void router.push('/logros') }, 8000)
  },
  { immediate: true },
)
</script>

<template>
  <RouterLink to="/logros" class="card game" aria-label="Racha, nivel y logros">
    <div class="row">
      <span class="flame" :class="{ lit: streak.current > 0 }"><BadgeIcon icon="flame" :size="30" /></span>
      <span class="streak">
        <strong v-if="streak.current > 0">{{ streak.current === 1 ? '1 semana' : `${streak.current} semanas` }} seguidas</strong>
        <strong v-else>Empieza tu racha</strong>
        <span class="week small muted">
          <span class="dots" aria-hidden="true"><i v-for="(on, i) in dots" :key="i" :class="{ on }" /></span>
          {{ streak.thisWeek.done ? 'Semana cumplida' : `${streak.thisWeek.sessions} de ${streak.thisWeek.target} esta semana` }}
        </span>
      </span>
      <span class="level num">Nivel {{ level.level }}</span>
    </div>
    <div class="bar" role="progressbar" :aria-valuenow="game.points.total" :aria-valuemin="level.from" :aria-valuemax="level.to" aria-label="Puntos del nivel">
      <span :style="{ width: `${progress}%` }" />
    </div>
    <p class="small muted foot">
      <span>{{ game.points.total }} / {{ level.to }} puntos</span>
      <span class="more">Ver logros ›</span>
    </p>
  </RouterLink>
</template>

<style scoped>
.game {
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: inherit;
  text-decoration: none;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.flame {
  color: var(--ink-2);
  display: flex;
}
.flame.lit {
  color: var(--warn);
}
.streak {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.week {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dots {
  display: inline-flex;
  gap: 4px;
}
.dots i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--action);
}
.dots i.on {
  background: var(--action);
}
.level {
  font-size: 22px;
  color: var(--action-ink);
}
.bar {
  height: 10px;
  border-radius: 5px;
  background: var(--surface-2);
  overflow: hidden;
}
.bar span {
  display: block;
  height: 100%;
  background: var(--action);
  border-radius: 5px;
}
.foot {
  display: flex;
  justify-content: space-between;
  margin-top: -4px;
}
.more {
  color: var(--action-ink);
  font-weight: 700;
}
</style>
