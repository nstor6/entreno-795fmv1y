// Persistent storage (SPEC §13) and small per-device UI state in localStorage.

const ASKED_KEY = 'entreno:persist-asked'

export async function requestPersistenceOnFirstRun(): Promise<void> {
  if (readLocal(ASKED_KEY)) return
  writeLocal(ASKED_KEY, '1')
  await requestPersistence()
}

export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export interface StorageStatus {
  supported: boolean
  persisted: boolean
  usageBytes: number | null
}

export async function storageStatus(): Promise<StorageStatus> {
  try {
    if (!navigator.storage?.persisted) return { supported: false, persisted: false, usageBytes: null }
    const [persisted, estimate] = await Promise.all([navigator.storage.persisted(), navigator.storage.estimate?.()])
    return { supported: true, persisted, usageBytes: estimate?.usage ?? null }
  } catch {
    return { supported: false, persisted: false, usageBytes: null }
  }
}

export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeLocal(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Private mode or blocked storage: this state is only a convenience.
  }
}
