// Bar and plates of the gym, set once in Datos. Stored on this device only.
import { reactive, ref } from 'vue'
import { readLocal, writeLocal } from '../data/storage'
import { DEFAULT_BAR_KG, DEFAULT_PLATES } from '../domain/plates'

export interface PlateSettings {
  barKg: number
  plates: number[]
}

const KEY = 'entreno:plates'

function load(): PlateSettings {
  try {
    const raw = JSON.parse(readLocal(KEY) ?? 'null') as Partial<PlateSettings> | null
    if (raw && typeof raw.barKg === 'number' && Array.isArray(raw.plates)) {
      return { barKg: raw.barKg, plates: raw.plates.filter((p): p is number => typeof p === 'number') }
    }
  } catch {
    // Corrupt value: fall back to the defaults.
  }
  return { barKg: DEFAULT_BAR_KG, plates: [...DEFAULT_PLATES] }
}

export const plateSettings = ref<PlateSettings>(load())

export function savePlateSettings(next: PlateSettings): void {
  plateSettings.value = next
  writeLocal(KEY, JSON.stringify(next))
}

// Whether the plate breakdown is shown for an exercise (you switch it on for barbell lifts).
// Reactive, so every set of that exercise updates when it's switched.
const shown = reactive(new Map<string, boolean>())

export function platesShownFor(exerciseId: string): boolean {
  if (!shown.has(exerciseId)) shown.set(exerciseId, readLocal(`entreno:plates-on:${exerciseId}`) === '1')
  return shown.get(exerciseId)!
}

export function setPlatesShownFor(exerciseId: string, on: boolean): void {
  shown.set(exerciseId, on)
  writeLocal(`entreno:plates-on:${exerciseId}`, on ? '1' : null)
}
