import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'frontend'), // 👈 frontend es la raíz
  publicDir: path.resolve(__dirname, 'frontend', 'public'),
  build: {
    outDir: path.resolve(__dirname, 'dist'), // salida en /dist
    emptyOutDir: true
  },
  server: {
    port: 5173,
  }
})
