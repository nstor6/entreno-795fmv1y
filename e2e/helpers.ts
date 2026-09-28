import { expect, type Page } from '@playwright/test'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// The real routine when it's there (local), otherwise the public demo (GitHub Actions).
const REAL = fileURLToPath(new URL('../data/rutina-fase1.json', import.meta.url))
const DEMO = fileURLToPath(new URL('../fixtures/rutina-demo.json', import.meta.url))
export const ROUTINE_FILE = existsSync(REAL) ? REAL : DEMO

/** Imports the phase 1 routine from Datos, like choosing the file on the phone. */
export async function importRoutine(page: Page): Promise<void> {
  await page.goto('#/datos')
  await page.locator('input[type=file]').first().setInputFiles(ROUTINE_FILE)
  await expect(page.getByRole('status')).toContainText('Rutina importada: Fase 1')
}

/** Starts the given day from Hoy and waits for the session screen. */
export async function startSession(page: Page, dayKey: string): Promise<void> {
  await page.goto('#/')
  await page.getByRole('group', { name: 'Elegir sesión' }).getByRole('button', { name: dayKey, exact: true }).click()
  await page.getByRole('button', { name: 'Empezar sesión' }).click()
  await expect(page).toHaveURL(/#\/sesion\//)
}

export function exerciseCard(page: Page, name: string) {
  return page.locator('article.exercise').filter({ has: page.getByRole('heading', { name, exact: true }) })
}

export function focusRow(page: Page, name: string) {
  return page.locator('button.focus-row').filter({ has: page.getByText(name, { exact: true }) })
}

/** Opens an exercise in focus mode (tapping its folded row if needed) and returns its card. */
export async function openExercise(page: Page, name: string) {
  const row = focusRow(page, name)
  const card = exerciseCard(page, name)
  // Wait for the session to render one or the other before deciding.
  await expect(card.or(row)).toBeVisible()
  if (await row.isVisible()) await row.tap()
  await expect(card).toBeVisible()
  return card
}
