/**
 * `sync` на этом компьютере — с настоящим Boosty, но вместо бакета папка `.bucket`
 * (в .gitignore): `npm run sync:local`. Токены — в `.bucket/boosty/auth.json`,
 * `BOOSTY_BLOG` и `EMAIL_HASH_SECRET` — в `.env`.
 *
 * Осторожно: обновлённые здесь токены Boosty живут только в `.bucket`. Если та же пара
 * уже лежит в облачном бакете, после обновления здесь облачная перестанет работать —
 * перед запуском в облаке положите туда `.bucket/boosty/auth.json`.
 */
import { join } from 'node:path'
import { DirStorage, requireEnv } from '@espanolcontim/functions-shared'
import { BoostyClient } from './boosty.ts'
import { runSync } from './sync.ts'

const ROOT = join(import.meta.dirname, '..', '..', '..')
process.loadEnvFile(join(ROOT, '.env'))

const report = await runSync({
  storage: new DirStorage(join(ROOT, '.bucket')),
  boosty: new BoostyClient(),
  blog: requireEnv('BOOSTY_BLOG'),
  emailHashSecret: requireEnv('EMAIL_HASH_SECRET'),
  now: Date.now,
})
console.log(report)
