// Plates per side of the bar for a total load. A tool, not a training rule.
import { formatNumber } from './format'

export const DEFAULT_BAR_KG = 20
export const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25]

export interface PlateLoad {
  /** Plates for one side, heaviest first. */
  perSide: number[]
  /** Part of the total that the available plates can't make (both sides together). */
  missingKg: number
}

/** Greedy split with as many plates of each size as needed; null if the total is below the bar. */
export function platesPerSide(totalKg: number, barKg: number, available: number[]): PlateLoad | null {
  const toG = (kg: number) => Math.round(kg * 1000)
  if (toG(totalKg) < toG(barKg)) return null
  let sideG = Math.floor((toG(totalKg) - toG(barKg)) / 2)
  const perSide: number[] = []
  for (const plate of [...new Set(available)].filter((p) => p > 0).sort((a, b) => b - a)) {
    const g = toG(plate)
    while (sideG >= g) {
      perSide.push(plate)
      sideG -= g
    }
  }
  const loadedG = toG(barKg) + 2 * perSide.reduce((sum, p) => sum + toG(p), 0)
  return { perSide, missingKg: (toG(totalKg) - loadedG) / 1000 }
}

/** «Por lado: 20 + 1,25», «Solo la barra», with what can't be loaded. */
export function platesText(load: PlateLoad | null, barKg: number): string {
  if (!load) return `Menos que la barra (${formatNumber(barKg)} kg)`
  const base = load.perSide.length ? `Por lado: ${load.perSide.map(formatNumber).join(' + ')}` : 'Solo la barra'
  return load.missingKg > 0 ? `${base} (faltan ${formatNumber(load.missingKg)} kg)` : base
}
