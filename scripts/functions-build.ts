/**
 * Сборка функций Yandex Cloud: `npm run functions:build` [имена].
 * Каждая `functions/<имя>/src/index.ts` → `functions/<имя>/dist/index.js` — один файл
 * со всеми зависимостями (zod, общий код), без node_modules. Рядом — package.json с
 * `"type": "module"`: среда nodejs22 грузит index.js как ES-модуль. Точка входа — `index.handler`.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'rolldown'

const FUNCTIONS = join(import.meta.dirname, '..', 'functions')
const ALL = ['sync']

const names = process.argv.slice(2)
for (const name of names.length ? names : ALL) {
  const input = join(FUNCTIONS, name, 'src', 'index.ts')
  if (!existsSync(input)) throw new Error(`Нет ${input}`)
  const dist = join(FUNCTIONS, name, 'dist')
  rmSync(dist, { recursive: true, force: true })
  mkdirSync(dist, { recursive: true })
  await build({
    input,
    platform: 'node',
    // Версия Node в среде nodejs22 Yandex Cloud — 22.15.
    transform: { target: 'node22' },
    output: { file: join(dist, 'index.js'), format: 'esm' },
    logLevel: 'warn',
  })
  writeFileSync(join(dist, 'package.json'), `${JSON.stringify({ type: 'module' }, null, 2)}\n`)
  console.log(`functions/${name}/dist/index.js`)
}
