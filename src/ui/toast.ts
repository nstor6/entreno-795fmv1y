// One short message at a time above the tab bar, optionally with an action such as «Deshacer».
import { shallowReactive } from 'vue'

export interface ToastAction {
  label: string
  run: () => void | Promise<void>
}

export interface Toast {
  id: number
  text: string
  action?: ToastAction
}

export const toast = shallowReactive<{ current: Toast | null }>({ current: null })

let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0

export function showToast(text: string, action?: ToastAction, ms = 6000): void {
  clearTimeout(timer)
  toast.current = { id: ++seq, text, action }
  timer = setTimeout(dismissToast, ms)
}

export function dismissToast(): void {
  clearTimeout(timer)
  toast.current = null
}

export async function runToastAction(): Promise<void> {
  const action = toast.current?.action
  dismissToast()
  await action?.run()
}
