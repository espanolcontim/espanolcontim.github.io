/**
 * `sync` на этом компьютере — с настоящим Boosty, но вместо бакета папка `.bucket`
 * (в .gitignore): `npm run sync:local`. Токены — в `.bucket/boosty/auth.json`,
 * `BOOSTY_BLOG` и `EMAIL_HASH_SECRET` — в `.env`.
 *
 * Токены здесь — от своего, отдельного входа в Boosty, а не копия облачных: refresh token
 * после обновления новый, и две копии одного входа выбивали бы друг друга.
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
