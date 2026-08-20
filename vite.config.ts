import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Honour PORT so a harness that assigns a free port gets the server it asked
  // for, instead of Vite silently walking to the next one.
  server: process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : undefined,
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // The harness files under .superpowers are mockups, not tests.
    exclude: ['node_modules', 'dist', '.superpowers'],
  },
})
