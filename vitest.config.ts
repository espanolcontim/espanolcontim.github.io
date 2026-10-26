import { defineConfig } from 'vitest/config'

// Тесты лежат рядом с кодом в каждом пакете.
export default defineConfig({
  test: {
    projects: ['packages/*', 'scripts', 'apps/web'],
  },
})
