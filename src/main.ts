import '@fontsource/atkinson-hyperlegible/latin-400.css'
import '@fontsource/atkinson-hyperlegible/latin-700.css'
import '@fontsource/barlow-condensed/latin-600.css'
import './styles/base.css'

import { registerSW } from 'virtual:pwa-register'
import { createApp } from 'vue'
import App from './App.vue'
import { requestPersistenceOnFirstRun } from './data/storage'
import { router } from './router'

createApp(App).use(router).mount('#app')
void requestPersistenceOnFirstRun()

// Auto-update: when a new version has been downloaded, the page reloads into it.
// Every change is saved as it happens, so the reload loses nothing.
registerSW({ immediate: true })
