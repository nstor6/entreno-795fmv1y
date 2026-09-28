import { expect, test } from '@playwright/test'
import { exerciseCard, importRoutine, openExercise, startSession } from './helpers'

// Monday of week 2 of phase 1, so the week and its targets are always the same.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-28T10:00:00+02:00'))
})

test('importing the routine shows days A, B and C and proposes A', async ({ page }) => {
  await importRoutine(page)
  await page.goto('#/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fase 1 · semana 2')
  const days = page.getByRole('group', { name: 'Elegir sesión' }).getByRole('button')
  await expect(days).toHaveText(['A', 'B', 'C'])
  await expect(page.getByRole('heading', { name: 'Sesión A' })).toBeVisible()
})

test('a whole session: sets, rest timer, reload in the middle, finish and history', async ({ page }) => {
  await importRoutine(page)
  await startSession(page, 'A')

  const bench = await openExercise(page, 'Press banca')
  await expect(bench.getByText('3 × 6-8 · RIR 3 · 2-3 min')).toBeVisible()
  await expect(bench.locator('.suggestion')).toHaveText('Busca una carga que te deje en RIR 3.')
  await bench.getByRole('button', { name: 'Añadir serie' }).click()
  const load = bench.getByRole('textbox', { name: 'kg' })
  await load.fill('60')
  await load.press('Enter')
  await bench.getByRole('button', { name: 'Más reps' }).click()
  await bench.getByRole('button', { name: 'Más reps' }).click()
  await bench.getByRole('group', { name: 'RIR' }).getByRole('button', { name: '3', exact: true }).click()

  // Logging the RIR starts the rest countdown with the plan's range.
  await expect(page.getByRole('timer')).toContainText('Descanso · Press banca')
  await expect(page.getByRole('timer')).toContainText('Plan: 2-3 min')

  // A second set copies the first one's load and reps; its RIR is logged set by set.
  await bench.getByRole('button', { name: 'Añadir serie' }).click()
  await expect(bench.getByRole('textbox', { name: 'kg' }).nth(1)).toHaveValue('60')
  await expect(bench.getByRole('textbox', { name: 'reps' }).nth(1)).toHaveValue('8')
  const secondRir = bench.getByRole('group', { name: 'RIR' }).nth(1)
  await expect(secondRir.getByRole('button', { pressed: true })).toHaveCount(0)
  await secondRir.getByRole('button', { name: '3', exact: true }).click()

  // Closing the app in the middle keeps everything, including the open exercise.
  await page.reload()
  await expect(bench.getByRole('textbox', { name: 'kg' })).toHaveCount(2)
  await expect(page.getByRole('timer')).toBeVisible()

  await page.getByRole('button', { name: 'Terminar sesión' }).click()
  await page.getByRole('button', { name: 'Toca otra vez para terminar' }).click()
  await expect(page.getByRole('region', { name: 'Resumen de la sesión' })).toContainText('Press banca 60 kg: 8, 8 · RIR 3, 3')
  await expect(page.getByRole('timer')).toHaveCount(0)

  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Historial' }).click()
  await expect(page.getByRole('link', { name: /Sesión A/ })).toContainText('2 series')
})

test('deleting a set can be undone', async ({ page }) => {
  await importRoutine(page)
  await startSession(page, 'A')
  const bench = await openExercise(page, 'Press banca')
  await bench.getByRole('button', { name: 'Añadir serie' }).click()
  await expect(bench.locator('.set')).toHaveCount(1)

  await bench.getByRole('button', { name: 'Borrar' }).click()
  await expect(bench.locator('.set')).toHaveCount(0)
  await page.getByRole('button', { name: 'Deshacer' }).click()
  await expect(bench.locator('.set')).toHaveCount(1)
})

test('discarding a session started by mistake, and undoing it', async ({ page }) => {
  await importRoutine(page)
  await startSession(page, 'B')
  await page.getByRole('button', { name: 'Descartar sesión' }).click()
  await page.getByRole('button', { name: 'Toca otra vez para borrarla entera' }).click()
  await expect(page).toHaveURL(/#\/$/)
  await expect(page.getByRole('button', { name: 'Empezar sesión' })).toBeVisible()

  await page.getByRole('button', { name: 'Deshacer' }).click()
  await expect(page.getByRole('link', { name: 'Continuar sesión' })).toBeVisible()
})

test('diary: a red flag shows the alarm at once', async ({ page }) => {
  await importRoutine(page)
  await page.goto('#/')
  await page.getByText('Hinchazón, bloqueo o fallo').click()
  await expect(page.getByRole('alert')).toHaveText('Hinchazón, bloqueo o sensación de fallo: consúltalo con un fisio o médico.')
})

test('backup: export, wipe everything, import, and the data is back', async ({ page }, testInfo) => {
  await importRoutine(page)
  await startSession(page, 'A')
  await (await openExercise(page, 'Press banca')).getByRole('button', { name: 'Añadir serie' }).click()
  await expect(exerciseCard(page, 'Press banca').locator('.set')).toHaveCount(1)

  await page.goto('#/datos')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar copia' }).click()])
  expect(download.suggestedFilename()).toBe('entreno-backup-2026-09-28.json')
  const file = testInfo.outputPath('backup.json')
  await download.saveAs(file)

  // Wipe the database as if the browser had lost it.
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('entreno')
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
      req.onblocked = () => resolve()
    })
  })
  await page.reload()
  await page.goto('#/historial')
  await expect(page.getByText('Aún no hay sesiones')).toBeVisible()

  await page.goto('#/datos')
  await page.locator('input[type=file]').nth(1).setInputFiles(file)
  await expect(page.getByRole('alertdialog')).toContainText('1 sesiones')
  await page.getByRole('button', { name: 'Reemplazar mis datos' }).click()
  await expect(page.getByRole('status')).toContainText('Copia importada')

  await page.goto('#/historial')
  await expect(page.getByRole('link', { name: /Sesión A/ })).toContainText('1 serie')
})

test('weekly summary for the current week', async ({ page }) => {
  await importRoutine(page)
  await startSession(page, 'A')
  await page.getByRole('button', { name: 'Terminar sesión' }).click()
  await page.getByRole('button', { name: 'Toca otra vez para terminar' }).click()

  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Resumen' }).click()
  const text = page.locator('#summary-text')
  await expect(text).toHaveValue(/^Semana 2 · Fase 1 \(28 sep – 4 oct\)\nSueño: sin registros\nRodilla: sin molestias/)
  await expect(text).toHaveValue(/Lun 28 · Sesión A\nSentadilla trasera: no hecho/)
})

test('works offline once installed', async ({ page }) => {
  await page.goto('./')
  // Wait until the service worker controls the page, as after the first visit on the phone.
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
  await importRoutine(page)

  await page.context().setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Datos')
  await page.goto('#/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fase 1 · semana 2')
  await startSession(page, 'A')
  await (await openExercise(page, 'Press banca')).getByRole('button', { name: 'Añadir serie' }).click()
  await expect(exerciseCard(page, 'Press banca').locator('.set')).toHaveCount(1)
})
