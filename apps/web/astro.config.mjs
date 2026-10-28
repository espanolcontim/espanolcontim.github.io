import react from '@astrojs/react'
import { defineConfig } from 'astro/config'

export default defineConfig({
  // Сайт — в бакете Object Storage на своём домене (docs/object-storage.md); другой адрес — SITE_URL при сборке.
  site: process.env.SITE_URL ?? 'https://espanolcontim.ru',
  // Только статика: бакет отдаёт файлы, серверного рендеринга нет.
  output: 'static',
  // Урок — папка с index.html: /lessons/a0-01/ → lessons/a0-01/index.html.
  build: { format: 'directory' },
  trailingSlash: 'always',
  integrations: [react()],
})
