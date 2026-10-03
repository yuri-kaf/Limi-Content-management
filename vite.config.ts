import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Tests run in the team's timezone, Nepal's UTC+5:45, on any machine: a date
// bug that only shows east of Greenwich would otherwise pass on a UTC one. It
// is set here, before any test worker starts, because a worker thread cannot
// change its timezone once it is running.
if (process.env.VITEST) process.env.TZ = 'Asia/Kathmandu'

export default defineConfig({
  plugins: [react()],
  // Honour PORT so a harness that assigns a free port gets the server it asked
  // for, instead of Vite silently walking to the next one.
  server: process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : undefined,
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // The harness files under .superpowers are mockups, not tests. Worktrees
    // under .claude are whole other checkouts of this repo, and their tests
    // would otherwise run alongside — and be counted with — this one's.
    exclude: [...configDefaults.exclude, '.superpowers/**', '**/.claude/**'],
  },
})
