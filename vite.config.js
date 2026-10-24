import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Emre Ders Takip',
        short_name: 'Ders Takip',
        description: 'Deneme sonuçları, hata defteri ve konu tekrar takibi',
        lang: 'tr',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f6f7fb',
        theme_color: '#4f46e5',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: { globPatterns: ['**/*.{js,mjs,css,html,svg,png}'], maximumFileSizeToCacheInBytes: 4 * 1024 * 1024 }
    })
  ]
})
