<script setup lang="ts">
// Only mounted for a finished session: it reads every table to compare with the past.
import { computed } from 'vue'
import { db } from '../data/instance'
import { useLive } from '../data/live'
import { loadProgress } from '../data/queries'
import { formatNumber } from '../domain/format'
import { sessionRecords } from '../domain/progress'

const props = defineProps<{ workoutId: string }>()
const { data } = useLive(() => loadProgress(db))

const records = computed(() => {
  const d = data.value
  if (!d) return []
  const names = new Map(d.exercises.map((e) => [e.id, e.name]))
  return sessionRecords(props.workoutId, d.exercises, d.workouts, d.workoutExercises, d.sets, d.measurements).map((r) => ({
    ...r,
    name: names.get(r.exerciseId) ?? r.exerciseId,
  }))
})
</script>

<template>
  <div v-if="records.length" class="notice notice-info records">
    <strong>{{ records.length === 1 ? 'Nuevo mejor 1RM estimado' : 'Nuevos mejores 1RM estimados' }}</strong>
    <ul>
      <li v-for="r in records" :key="r.exerciseId">
        {{ r.name }}: {{ formatNumber(r.value) }} kg <span class="small">(antes {{ formatNumber(r.previous) }} kg)</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.records ul {
  margin: 6px 0 0;
  padding-left: 18px;
}
</style>
