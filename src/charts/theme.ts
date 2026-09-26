// Chart.js setup and colors read from the app's CSS tokens, so charts follow light/dark mode.
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { onScopeDispose, ref } from 'vue'

Chart.register(LineController, LineElement, PointElement, BarController, BarElement, CategoryScale, LinearScale, Tooltip)
Chart.defaults.font.family = "'Atkinson Hyperlegible', system-ui, sans-serif"
Chart.defaults.font.size = 13
Chart.defaults.animation = false

export interface ChartColors {
  ink: string
  ink2: string
  line: string
  surface: string
  bg: string
  action: string
  warn: string
}

function readColors(): ChartColors {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string) => css.getPropertyValue(name).trim()
  return {
    ink: v('--ink'),
    ink2: v('--ink-2'),
    line: v('--line'),
    surface: v('--surface'),
    bg: v('--bg'),
    action: v('--action'),
    warn: v('--warn'),
  }
}

/** Current chart colors; updates when the system switches between light and dark. */
export function useChartColors() {
  const colors = ref<ChartColors>(readColors())
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const update = () => (colors.value = readColors())
  media.addEventListener('change', update)
  onScopeDispose(() => media.removeEventListener('change', update))
  return colors
}
