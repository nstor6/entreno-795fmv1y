<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'

const tabs = [
  { to: '/', label: 'Hoy', icon: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z' },
  { to: '/historial', label: 'Historial', icon: 'M12 7v5l3 2M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9z' },
  { to: '/medidas', label: 'Medidas', icon: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8 9a4 4 0 0 1 8 0M12 9l1.5-2' },
  { to: '/datos', label: 'Datos', icon: 'M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zm0 0v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3' },
]
</script>

<template>
  <main class="page">
    <RouterView v-slot="{ Component, route }">
      <component :is="Component" :key="route.fullPath" />
    </RouterView>
  </main>
  <nav class="tabbar" aria-label="Secciones">
    <RouterLink v-for="t in tabs" :key="t.to" :to="t.to" class="tab" active-class="" exact-active-class="is-active">
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <path :d="t.icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span>{{ t.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.page {
  max-width: 560px;
  margin: 0 auto;
  padding: 16px 16px calc(var(--nav-h) + 24px + env(safe-area-inset-bottom));
}
.tabbar {
  position: fixed;
  inset: auto 0 0 0;
  height: calc(var(--nav-h) + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  display: flex;
  background: var(--surface);
  border-top: 1px solid var(--line);
  z-index: 10;
}
.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--ink-2);
  text-decoration: none;
  font-size: 13px;
  font-weight: 700;
}
.tab.is-active {
  color: var(--action-ink);
}
</style>
