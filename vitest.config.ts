import { defineConfig } from 'vitest/config'

// Тесты лежат рядом с кодом в каждом пакете; у сайта появятся вместе с первыми островами.
export default defineConfig({
  test: {
    projects: ['packages/*', 'scripts'],
  },
})
