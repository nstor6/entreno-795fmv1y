// Removes stale per-device screen notes from localStorage. Reads the database only to know
// which sessions are closed; it never writes to it.
import { localDate } from '../domain/dates'
import { staleLocalKeys } from '../domain/localCleanup'
import type { EntrenoDB } from './db'

type KeyStore = Pick<Storage, 'length' | 'key' | 'removeItem'>

export async function cleanLocalNotes(db: EntrenoDB, store: KeyStore | null = safeLocalStorage(), today = localDate()): Promise<string[]> {
  if (!store) return []
  const keys: string[] = []
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i)
    if (k?.startsWith('entreno:')) keys.push(k)
  }
  if (keys.length === 0) return []
  const [workouts, workoutExercises] = await Promise.all([db.workouts.toArray(), db.workoutExercises.toArray()])
  const stale = staleLocalKeys(keys, workouts, workoutExercises, today)
  for (const k of stale) store.removeItem(k)
  return stale
}

function safeLocalStorage(): Storage | null {
  try {
    return localStorage
  } catch {
    return null
  }
}
