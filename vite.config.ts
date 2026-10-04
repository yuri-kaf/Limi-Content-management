import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Tests run in the team's timezone, Nepal's UTC+5:45, on any machine: a date
// bug that only shows east of Greenwich would otherwise pass on a UTC one. It
// is set here, before the pool below starts its test processes, so each of
// them starts in that zone. A test that moves its own process to another zone
// puts this one back when it is done.
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
