import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      includeAssets: ['vite.svg'],
      manifest: {
        name: 'SmartSmile',
        short_name: 'SmartSmile',
        theme_color: '#0EA5E9',
        background_color: '#0F172A',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/vite.svg', sizes: '512x512', type: 'image/svg+xml' },
          {
            src: '/vite.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:${Number(process.env.AI_SCAN_PORT ?? 8811)}`,
        changeOrigin: true,
      },
    },
  },
})
