import react from '@astrojs/react'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://espanolcontim.sourcecraft.site',
  // Только статика: SourceCraft Sites не умеет серверный рендеринг.
  output: 'static',
  // Урок — папка с index.html: /lessons/a0-01/ → lessons/a0-01/index.html.
  build: { format: 'directory' },
  trailingSlash: 'always',
  integrations: [react()],
})
