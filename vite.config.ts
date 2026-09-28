/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the app under /<repo>/; set BASE_PATH at build time.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Entreno',
        short_name: 'Entreno',
        description: 'Registro de entrenamiento de fuerza',
        lang: 'es-ES',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        theme_color: '#2743C9',
        background_color: '#F3F0E8',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Long-press on the home-screen icon (Android).
        shortcuts: [
          { name: 'Sesión', short_name: 'Sesión', url: `${base}#/sesion-actual`, icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Resumen semanal', short_name: 'Resumen', url: `${base}#/resumen`, icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Progreso', short_name: 'Progreso', url: `${base}#/progreso`, icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        // Everything the app needs offline, fonts included.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
