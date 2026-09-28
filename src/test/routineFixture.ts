// Routine fixture for tests: the real one (data/, local only) when it's there, otherwise the
// public demo with the same exercises and numbers but no notes (GitHub Actions).
// import.meta.glob returns {} for a missing file, so neither import breaks the other setup.
type RoutineJson = typeof import('../../fixtures/rutina-demo.json')

const real = import.meta.glob<RoutineJson>('../../data/rutina-fase1.json', { eager: true, import: 'default' })
const demo = import.meta.glob<RoutineJson>('../../fixtures/rutina-demo.json', { eager: true, import: 'default' })

export const usingRealRoutine = Object.keys(real).length > 0
export const rutina: RoutineJson = (Object.values(real)[0] ?? Object.values(demo)[0])!
