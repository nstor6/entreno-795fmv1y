// A very short buzz so a tap is felt without looking (Android; ignored where unsupported).
export function tick(): void {
  try {
    navigator.vibrate?.(10)
  } catch {
    // Some browsers throw instead of ignoring: the buzz is a nicety.
  }
}
