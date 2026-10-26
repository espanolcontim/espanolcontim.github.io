import react from '@astrojs/react'
import { defineConfig } from 'astro/config'

export default defineConfig({
  // Сейчас сайт на GitHub Pages; для SourceCraft Sites адрес задаётся SITE_URL при сборке.
  site: process.env.SITE_URL ?? 'https://espanolcontim.github.io',
  // Только статика: ни GitHub Pages, ни SourceCraft Sites не умеют серверный рендеринг.
  output: 'static',
  // Урок — папка с index.html: /lessons/a0-01/ → lessons/a0-01/index.html.
  build: { format: 'directory' },
  trailingSlash: 'always',
  integrations: [react()],
})
