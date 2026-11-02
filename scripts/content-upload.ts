/**
 * `npm run content:upload` — платные половины уроков из content/private/lessons в приватный
 * бакет, откуда их отдаёт `functions/api`. Загружает только изменённое, удаляет уроки, которых
 * больше нет среди платных. `-- --check` — показать, что изменится, ничего не меняя.
 *
 * Ключ сервисного аккаунта `content-upload` (docs/backend.md, шаг 16) — в .env:
 * CONTENT_UPLOAD_KEY_ID и CONTENT_UPLOAD_SECRET. Бакет — CONTENT_BUCKET, по умолчанию espanolcontim-private.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { LESSONS_PREFIX, lessonFile, planUpload } from './upload/plan.ts'
import { S3Bucket, YANDEX_ENDPOINT } from './upload/s3.ts'

const ROOT = join(import.meta.dirname, '..')
const DIR = join(ROOT, 'content', 'private', 'lessons')
const ENV = join(ROOT, '.env')

const fail = (message: string): never => {
  console.error(message)
  process.exit(1)
}

const { values: args } = parseArgs({ options: { check: { type: 'boolean', default: false } } })
if (existsSync(ENV)) process.loadEnvFile(ENV)

const accessKeyId = process.env.CONTENT_UPLOAD_KEY_ID
const secretAccessKey = process.env.CONTENT_UPLOAD_SECRET
if (!accessKeyId || !secretAccessKey) {
  fail('В .env нет CONTENT_UPLOAD_KEY_ID и CONTENT_UPLOAD_SECRET — docs/backend.md, шаг 16')
}
if (!existsSync(DIR)) fail('Нет content/private/lessons — сначала npm run content:import')

const files = readdirSync(DIR)
  .filter((name) => name.endsWith('.json'))
  .toSorted()
  .map((name) => lessonFile(name, readFileSync(join(DIR, name))))
if (files.length === 0) fail('В content/private/lessons пусто — сначала npm run content:import')

const bucket = new S3Bucket({
  endpoint: YANDEX_ENDPOINT,
  bucket: process.env.CONTENT_BUCKET ?? 'espanolcontim-private',
  credentials: { accessKeyId: accessKeyId ?? '', secretAccessKey: secretAccessKey ?? '' },
  fetch: globalThis.fetch,
  now: () => new Date(),
})

const { upload, remove } = planUpload(files, await bucket.list(LESSONS_PREFIX))
for (const file of upload) console.log(`загрузить ${file.key}`)
for (const key of remove) console.log(`удалить   ${key}`)
console.log(`уроков: ${files.length}, загрузить: ${upload.length}, удалить: ${remove.length}`)

if (!args.check) {
  for (const file of upload)
    await bucket.put(file.key, file.body, 'application/json; charset=utf-8')
  for (const key of remove) await bucket.delete(key)
  console.log('готово')
}
