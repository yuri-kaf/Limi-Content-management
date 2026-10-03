import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
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
    // Processes, not worker threads: a test that sets process.env.TZ to reach a
    // western time zone only changes the zone in a process of its own. Under
    // threads the assignment is silently ignored and such a test cannot fail.
    pool: 'forks',
    // The harness files under .superpowers are mockups, not tests. Worktrees
    // under .claude are whole other checkouts of this repo, and their tests
    // would otherwise run alongside — and be counted with — this one's.
    exclude: [...configDefaults.exclude, '.superpowers/**', '**/.claude/**'],
  },
})
