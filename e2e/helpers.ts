import { expect, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

export const ROUTINE_FILE = fileURLToPath(new URL('../data/rutina-fase1.json', import.meta.url))

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
