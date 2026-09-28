import { expect, test, type Page } from '@playwright/test'
import { importRoutine, openExercise, startSession } from './helpers'

const TABS: [label: string, heading: RegExp][] = [
  ['Historial', /^Historial$/],
  ['Progreso', /^Progreso$/],
  ['Resumen', /^Resumen$/],
  ['Datos', /^Datos$/],
  ['Hoy', /^Fase 1 · semana 2$/],
]

async function tapEveryTab(page: Page) {
  const nav = page.getByRole('navigation', { name: 'Secciones' })
  for (const [label, heading] of TABS) {
    await nav.getByRole('link', { name: label }).tap()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading)
  }
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-28T10:00:00+02:00'))
})

test('tapping each tab changes the screen', async ({ page }) => {
  await importRoutine(page)
  await page.goto('#/')
  await tapEveryTab(page)
})

test('tabs work from a session with the rest bar and an undo message on screen', async ({ page }) => {
  await importRoutine(page)
  await startSession(page, 'A')
  const bench = await openExercise(page, 'Press banca')
  await bench.getByRole('button', { name: 'Añadir serie' }).tap()
  await bench.getByRole('button', { name: 'Añadir serie' }).tap()
  await expect(bench.locator('.set')).toHaveCount(2)
  await bench.getByRole('group', { name: 'RIR' }).last().getByRole('button', { name: '3', exact: true }).tap()
  await bench.getByRole('button', { name: 'Borrar' }).first().tap()
  await expect(page.getByRole('timer')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Deshacer' })).toBeVisible()
  await tapEveryTab(page)
})

test.describe('without the service worker', () => {
  test.use({ serviceWorkers: 'block' })

  // Once started, the app must not need any other file: a page left open across a deploy
  // can't fetch the previous version's files any more (they are gone from the server).
  test('tabs keep working when nothing else can be downloaded after start', async ({ page }) => {
    await importRoutine(page)
    await page.goto('#/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fase 1 · semana 2')
    await page.context().setOffline(true)
    await tapEveryTab(page)
  })
})
