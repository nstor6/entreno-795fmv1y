// JSON pasted from a chat: may come wrapped in a message, ``` fences or typographic quotes.

export function parsePastedJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) {
    throw new Error('No encuentro la rutina en el texto. Copia el mensaje entero, desde la primera { hasta la última }.')
  }
  const json = text.slice(start, end + 1)
  try {
    return JSON.parse(json)
  } catch {
    // Chat apps and keyboards often turn "straight" quotes into “curly” ones.
    try {
      return JSON.parse(json.replace(/[“”]/g, '"'))
    } catch {
      throw new Error('El texto no es un JSON válido. Puede que falte un trozo: copia el mensaje entero otra vez.')
    }
  }
}
