import { createRouter, createWebHashHistory } from 'vue-router'
import TodayView from './views/TodayView.vue'

// Hash history so GitHub Pages never has to resolve deep links (SPEC §15).
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'today', component: TodayView },
    { path: '/sesion/:id', name: 'session', component: () => import('./views/SessionView.vue'), props: true },
    { path: '/historial', name: 'history', component: () => import('./views/HistoryView.vue') },
    { path: '/medidas', name: 'measurements', component: () => import('./views/MeasurementsView.vue') },
    { path: '/resumen', name: 'summary', component: () => import('./views/SummaryView.vue') },
    { path: '/datos', name: 'data', component: () => import('./views/DataView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
