import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'
import { VitePWA } from 'vite-plugin-pwa'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'Src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 // 5MB
      },
      devOptions: {
        enabled: false
      },
      manifest: {
        name: 'HGH Sejahtera',
        short_name: 'HGH',
        description: 'HGH Inventory & Reseller Management System',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './Src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://www.hghsejahtera.my',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
