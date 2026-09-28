<script setup lang="ts">
import type { BadgeIcon } from '../domain/gamification'

defineProps<{ icon: BadgeIcon | 'flame'; size?: number }>()

// Simple outline icons, one per badge family.
const PATHS: Record<BadgeIcon | 'flame', string> = {
  session: 'M3 12h2M19 12h2M6 8v8M18 8v8M8 10v4M16 10v4M8 12h8',
  full: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l2.5 2.5L16 9.5',
  streak: 'M12 21c4 0 6.5-2.6 6.5-6.2 0-3.6-2.7-6-4-8.8-.6 2.4-1.8 3.6-3.1 4.3.3-2.7-.6-5.2-2.9-7.3.1 3.8-3.5 6.2-3.5 11.1C5 18.4 8 21 12 21z',
  flame: 'M12 21c4 0 6.5-2.6 6.5-6.2 0-3.6-2.7-6-4-8.8-.6 2.4-1.8 3.6-3.1 4.3.3-2.7-.6-5.2-2.9-7.3.1 3.8-3.5 6.2-3.5 11.1C5 18.4 8 21 12 21z',
  record: 'M8 4h8v4a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 3M16 6h3a3 3 0 0 1-3 3M12 12v4M9 20h6M10 16h4v4h-4z',
  diary: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  measure: 'M4 16L16 4l4 4L8 20zM8 12l2 2M11 9l2 2M14 6l2 2',
}
</script>

<template>
  <svg :width="size ?? 24" :height="size ?? 24" viewBox="0 0 24 24" aria-hidden="true">
    <path :d="PATHS[icon]" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>
