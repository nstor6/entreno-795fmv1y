import '@fontsource/atkinson-hyperlegible/latin-400.css'
import '@fontsource/atkinson-hyperlegible/latin-700.css'
import '@fontsource/barlow-condensed/latin-600.css'
import './styles/base.css'

import { registerSW } from 'virtual:pwa-register'
import { createApp } from 'vue'
import App from './App.vue'
import { cleanLocalNotes } from './data/cleanup'
import { db } from './data/instance'
import { requestPersistenceOnFirstRun } from './data/storage'
import { router } from './router'

createApp(App).use(router).mount('#app')
void requestPersistenceOnFirstRun()
// Tidy old screen notes a few seconds after start (never the database).
setTimeout(() => void cleanLocalNotes(db).catch((e: unknown) => console.error('cleanLocalNotes failed', e)), 5000)

// Auto-update: when a new version has been downloaded, the page reloads into it.
// Every change is saved as it happens, so the reload loses nothing.
registerSW({ immediate: true })
