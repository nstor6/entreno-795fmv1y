<script setup lang="ts">
// One series per panel (no legend: the title names it), marks per the chart spec:
// 2px lines, 8px points with a 2px surface ring, bars ≤ 24px with a 4px rounded end.
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js'
import { computed } from 'vue'
import { Bar, Line } from 'vue-chartjs'
import { useChartColors } from '../charts/theme'

const props = withDefaults(
  defineProps<{
    type: 'line' | 'bar'
    labels: string[]
    values: (number | null)[]
    color?: 'action' | 'warn'
    height?: number
    yMin?: number
    yMax?: number
    /** Accessible name of the chart. */
    label: string
    tooltipTitle: (index: number) => string
    tooltipLines: (index: number) => string[]
    /** Draw the x-axis labels (the lower panel of a stack shows them for both). */
    showXLabels?: boolean
  }>(),
  { color: 'action', height: 180, showXLabels: true },
)

const colors = useChartColors()

const data = computed(() => {
  const c = colors.value
  const hue = c[props.color]
  const dataset =
    props.type === 'line'
      ? {
          data: props.values,
          borderColor: hue,
          borderWidth: 2,
          borderCapStyle: 'round' as const,
          borderJoinStyle: 'round' as const,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointHitRadius: 16,
          pointBackgroundColor: hue,
          pointBorderColor: c.surface,
          pointBorderWidth: 2,
          spanGaps: false,
          tension: 0,
        }
      : {
          data: props.values,
          backgroundColor: hue,
          borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
          borderSkipped: 'start' as const,
          maxBarThickness: 24,
          categoryPercentage: 0.9,
          barPercentage: 0.9,
        }
  return { labels: props.labels, datasets: [dataset] }
})

const options = computed(() => {
  const c = colors.value
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    layout: { padding: { top: 8, right: 8 } },
    scales: {
      x: {
        grid: { display: false },
        border: { color: c.line },
        ticks: { display: props.showXLabels, color: c.ink2, maxRotation: 0, autoSkip: true, maxTicksLimit: 5 },
      },
      y: {
        min: props.yMin,
        max: props.yMax,
        grid: { color: c.line },
        border: { display: false },
        ticks: { color: c.ink2, maxTicksLimit: 4, precision: 1 },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        displayColors: false,
        backgroundColor: c.ink,
        titleColor: c.bg,
        bodyColor: c.bg,
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          title: (items: TooltipItem<'line' | 'bar'>[]) => (items[0] ? props.tooltipTitle(items[0].dataIndex) : ''),
          label: (item: TooltipItem<'line' | 'bar'>) => props.tooltipLines(item.dataIndex),
        },
      },
    },
  }
})
</script>

<template>
  <div class="panel" :style="{ height: `${height}px` }" role="img" :aria-label="label">
    <Line v-if="type === 'line'" :data="data as ChartData<'line'>" :options="options as ChartOptions<'line'>" />
    <Bar v-else :data="data as ChartData<'bar'>" :options="options as ChartOptions<'bar'>" />
  </div>
</template>

<style scoped>
.panel {
  position: relative;
  width: 100%;
}
</style>
