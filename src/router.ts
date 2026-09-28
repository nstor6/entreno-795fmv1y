import { createRouter, createWebHashHistory } from 'vue-router'
import { db } from './data/instance'
import DataView from './views/DataView.vue'
import ExerciseHistoryView from './views/ExerciseHistoryView.vue'
import HistoryView from './views/HistoryView.vue'
import ProgressView from './views/ProgressView.vue'
import SessionView from './views/SessionView.vue'
import SummaryView from './views/SummaryView.vue'
import TodayView from './views/TodayView.vue'

// Every screen is in the main bundle (no lazy routes): once the app has started it never
// needs another file from the server. With lazy chunks, a page left open across a deploy
// asked for chunk names that no longer existed and the tab bar silently stopped working.

// Hash history so GitHub Pages never has to resolve deep links (SPEC §15).
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'today', component: TodayView },
    { path: '/sesion/:id', name: 'session', component: SessionView, props: true },
    // Home-screen shortcut: the open session if there is one, otherwise Today to start one.
    {
      path: '/sesion-actual',
      name: 'current-session',
      component: TodayView,
      beforeEnter: async () => {
        const open = (await db.workouts.toArray())
          .filter((w) => w.deletedAt === null && w.finishedAt === null)
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
        return open ? `/sesion/${open.id}` : '/'
      },
    },
    { path: '/historial', name: 'history', component: HistoryView },
    { path: '/ejercicio/:id', name: 'exercise', component: ExerciseHistoryView, props: true },
    { path: '/progreso', name: 'progress', component: ProgressView },
    { path: '/medidas', redirect: '/progreso' },
    { path: '/resumen', name: 'summary', component: SummaryView },
    { path: '/datos', name: 'data', component: DataView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// Safety net: if loading something still fails during a navigation, reload straight into
// the screen that was tapped instead of staying put without a word.
const RELOAD_KEY = 'entreno:reloaded-for'
function session(action: (s: Storage) => string | null | void): string | null {
  try {
    return action(sessionStorage) ?? null
  } catch {
    return null
  }
}
router.onError((error, to) => {
  console.error('navigation failed', error)
  if (session((s) => s.getItem(RELOAD_KEY)) === to.fullPath) return // already reloaded once for this: don't loop
  session((s) => s.setItem(RELOAD_KEY, to.fullPath))
  window.location.hash = to.fullPath
  window.location.reload()
})
router.afterEach(() => void session((s) => s.removeItem(RELOAD_KEY)))
