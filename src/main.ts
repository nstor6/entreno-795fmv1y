import '@fontsource/atkinson-hyperlegible/latin-400.css'
import '@fontsource/atkinson-hyperlegible/latin-700.css'
import '@fontsource/barlow-condensed/latin-600.css'
import './styles/base.css'

import { createApp } from 'vue'
import App from './App.vue'
import { requestPersistenceOnFirstRun } from './data/storage'
import { router } from './router'

createApp(App).use(router).mount('#app')
void requestPersistenceOnFirstRun()
