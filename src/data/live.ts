import { liveQuery, type Subscription } from 'dexie'
import { onScopeDispose, shallowRef, watch, type ShallowRef, type WatchSource } from 'vue'

export interface Live<T> {
  data: ShallowRef<T | undefined>
  error: ShallowRef<unknown>
}

/** Dexie liveQuery as a Vue ref: re-runs whenever the tables it read change. */
export function useLive<T>(query: () => Promise<T> | T): Live<T> {
  const data = shallowRef<T>()
  const error = shallowRef<unknown>(null)
  const sub = subscribe(query, data, error)
  onScopeDispose(() => sub.unsubscribe())
  return { data, error }
}

/** Like useLive, but the query also depends on a Vue source and re-subscribes when it changes. */
export function useLiveWith<S, T>(source: WatchSource<S>, query: (s: S) => Promise<T> | T): Live<T> {
  const data = shallowRef<T>()
  const error = shallowRef<unknown>(null)
  let sub: Subscription | null = null
  watch(
    source,
    (s) => {
      sub?.unsubscribe()
      data.value = undefined
      sub = subscribe(() => query(s), data, error)
    },
    { immediate: true },
  )
  onScopeDispose(() => sub?.unsubscribe())
  return { data, error }
}

function subscribe<T>(query: () => Promise<T> | T, data: ShallowRef<T | undefined>, error: ShallowRef<unknown>): Subscription {
  return liveQuery(query).subscribe({
    next: (v) => {
      data.value = v
      error.value = null
    },
    error: (e: unknown) => {
      console.error(e)
      error.value = e
    },
  })
}
