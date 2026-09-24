import { liveQuery } from 'dexie'
import { onScopeDispose, shallowRef, type ShallowRef } from 'vue'

export interface Live<T> {
  data: ShallowRef<T | undefined>
  error: ShallowRef<unknown>
}

/** Dexie liveQuery as a Vue ref: re-runs whenever the tables it read change. */
export function useLive<T>(query: () => Promise<T> | T): Live<T> {
  const data = shallowRef<T>()
  const error = shallowRef<unknown>(null)
  const sub = liveQuery(query).subscribe({
    next: (v) => {
      data.value = v
      error.value = null
    },
    error: (e: unknown) => {
      console.error(e)
      error.value = e
    },
  })
  onScopeDispose(() => sub.unsubscribe())
  return { data, error }
}
