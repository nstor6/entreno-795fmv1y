import { expect, test, type Locator } from '@playwright/test'
import { exerciseCard, focusRow, importRoutine, openExercise, startSession } from './helpers'

// Monday of week 2: plan targets without the week 1 override (3 sets, dead bug 2).
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-28T10:00:00+02:00'))
})

/** Logs one set: add it and, when the exercise has an RIR target, tap the RIR of that set. */
async function logSet(card: Locator, rir?: string) {
  const before = await card.locator('.set').count()
  await card.getByRole('button', { name: 'Añadir serie' }).tap()
  // Without an RIR, adding finishes the set and the card may fold right away.
  if (!rir) return
  await expect(card.locator('.set')).toHaveCount(before + 1)
  await card.getByRole('group', { name: 'RIR' }).last().getByRole('button', { name: rir, exact: true }).tap()
}

test('one exercise open at a time; after its last set the next one opens', async ({ page }) => {
  await importRoutine(page)
  await startSession(page, 'A')

  await expect(page.locator('article.exercise')).toHaveCount(1)
  await expect(exerciseCard(page, 'Sentadilla trasera')).toBeVisible()
  await expect(page.locator('button.focus-row')).toHaveCount(5)

  const squat = exerciseCard(page, 'Sentadilla trasera')
  await logSet(squat, '3')
  await expect(page.getByRole('timer')).toContainText('Sentadilla trasera')

  // Correcting the RIR of that set doesn't move on or restart anything.
  await squat.getByRole('group', { name: 'RIR' }).last().getByRole('button', { name: '2', exact: true }).tap()
  await expect(squat).toBeVisible()

  await logSet(squat, '3')
  await logSet(squat, '3')
  await expect(exerciseCard(page, 'Press banca')).toBeVisible()
  await expect(page.locator('article.exercise')).toHaveCount(1)
  await expect(focusRow(page, 'Sentadilla trasera')).toContainText('✓')
})

test('superset: face pull → dead bug without rest, then rest and back to face pull', async ({ page }) => {
  await importRoutine(page)
  await startSession(page, 'A')

  const facePull = await openExercise(page, 'Face pull')
  await expect(page.getByText('Superserie · alterna los dos y descansa después del par')).toBeVisible()
  await logSet(facePull, '2')
  const deadBug = exerciseCard(page, 'Dead bug')
  await expect(deadBug).toBeVisible()
  await expect(page.getByRole('timer')).toHaveCount(0)

  // Dead bug has no RIR target: adding the set finishes it.
  await logSet(deadBug)
  await expect(page.getByRole('timer')).toContainText('Dead bug')
  await expect(exerciseCard(page, 'Face pull')).toBeVisible()
  await expect(focusRow(page, 'Dead bug')).toContainText('1/2')
})

test('«Siguiente» skips ahead and «Ver todos» shows every exercise', async ({ page }) => {
  await importRoutine(page)
  await startSession(page, 'A')
  await page.getByRole('button', { name: 'Siguiente: Press banca ›' }).tap()
  await expect(exerciseCard(page, 'Press banca')).toBeVisible()

  await page.getByRole('button', { name: 'Ver todos los ejercicios' }).tap()
  await expect(page.locator('article.exercise')).toHaveCount(6)
  await page.getByRole('button', { name: 'Ver un ejercicio a la vez' }).tap()
  await expect(page.locator('article.exercise')).toHaveCount(1)
})
