<script setup lang="ts">
// A folded exercise in focus mode: name, sets done and what was logged. Tap to open it.
import { computed } from 'vue'
import type { SessionExercise } from '../data/queries'
import { finishedSets } from '../domain/focus'
import { formatExerciseLine } from '../domain/format'
import type { Exercise } from '../domain/types'

const props = defineProps<{ item: SessionExercise; exercises: Map<string, Exercise> }>()
const emit = defineEmits<{ open: [] }>()

const working = computed(() => props.item.sets.filter((s) => !s.isWarmup))
const target = computed(() => props.item.workoutExercise.targetSets)
const finished = computed(() => finishedSets(props.item.sets, props.item.workoutExercise.rirMin !== null))
const done = computed(() => finished.value >= target.value)
const name = computed(() => props.item.planned?.name ?? props.item.workoutExercise.plannedExerciseId)
const line = computed(() => {
  const sets = working.value
  const first = sets[0]
  if (!first) return 'Pendiente'
  const exercise = props.exercises.get(first.exerciseId) ?? props.item.planned
  return exercise ? formatExerciseLine('', exercise, sets).replace(/^\s*:?\s*/, '') : ''
})
</script>

<template>
  <button type="button" class="focus-row" :class="{ done }" :aria-expanded="false" @click="emit('open')">
    <span class="status num" :aria-label="done ? 'Hecho' : `${finished} de ${target} series`">
      {{ done ? '✓' : `${finished}/${target}` }}
    </span>
    <span class="what">
      <strong>{{ name }}</strong>
      <span class="muted small">{{ line }}</span>
    </span>
    <span class="chev" aria-hidden="true">›</span>
  </button>
</template>

<style scoped>
.focus-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 64px;
  padding: 10px 12px 10px 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  text-align: left;
}
.status {
  min-width: 44px;
  font-size: 22px;
  color: var(--ink-2);
}
.done .status {
  color: var(--action-ink);
}
.done strong {
  color: var(--ink-2);
}
.what {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.what .small {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chev {
  font-size: 26px;
  color: var(--ink-2);
}
</style>
