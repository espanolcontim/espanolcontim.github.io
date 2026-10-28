/**
 * Выкладка собранного сайта (apps/web/dist) в бакет Object Storage:
 *
 *   node scripts/deploy-bucket.ts              загрузить изменённое, удалить лишнее
 *   node scripts/deploy-bucket.ts --force      загрузить всё заново (поменялись правила заголовков)
 *   node scripts/deploy-bucket.ts --dry-run    показать, что изменится, ничего не меняя
 *
 * Запускается из GitHub Actions после сборки с SITE_URL=https://espanolcontim.ru
 * (.github/workflows/deploy.yml). Работает через AWS CLI — он есть на раннерах
 * GitHub. Ключ сервисного аккаунта site-deploy — в AWS_ACCESS_KEY_ID и
 * AWS_SECRET_ACCESS_KEY. Бакет — DEPLOY_BUCKET, по умолчанию espanolcontim.ru;
 * имя бакета совпадает с доменом, сборка должна быть сделана для него.
 *
 * Заголовки и что считать изменённым — scripts/deploy/bucket.ts.
 */
import { execFile } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { promisify } from 'node:util'
import { bucketFile, deployPlan, type BucketFile } from './deploy/bucket.ts'

const DIST = join(import.meta.dirname, '..', 'apps', 'web', 'dist')
const BUCKET = process.env.DEPLOY_BUCKET ?? 'espanolcontim.ru'
const ENDPOINT = 'https://storage.yandexcloud.net'
/** Сколько файлов загружать одновременно. */
const PARALLEL = 8
/** Больше delete-objects за раз не принимает. */
const DELETE_BATCH = 1000

const args = process.argv.slice(2)
const force = args.includes('--force')
const dryRun = args.includes('--dry-run')

const exec = promisify(execFile)

const s3api = async (command: string, ...params: string[]): Promise<Record<string, unknown>> => {
  const { stdout } = await exec(
    'aws',
    [
      's3api',
      command,
      '--bucket',
      BUCKET,
      '--endpoint-url',
      ENDPOINT,
      '--output',
      'json',
      ...params,
    ],
    { maxBuffer: 64 * 1024 * 1024 },
  )
  return stdout.trim() === '' ? {} : (JSON.parse(stdout) as Record<string, unknown>)
}

const unquote = (etag: unknown): string => String(etag).replaceAll('"', '')

// --- сборка -------------------------------------------------------------------------

const readDist = (): BucketFile[] => {
  const files = readdirSync(DIST, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const path = join(entry.parentPath, entry.name)
      return bucketFile(relative(DIST, path).split(sep).join('/'), readFileSync(path))
    })
  // Пустая или чужая сборка удалила бы из бакета весь сайт.
  const keys = new Set(files.map((file) => file.key))
  for (const required of ['index.html', '404.html', 'sitemap.xml']) {
    if (!keys.has(required)) throw new Error(`В ${DIST} нет ${required} — сначала npm run build`)
  }
  const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf8')
  if (!sitemap.includes(`<loc>https://${BUCKET}/</loc>`)) {
    throw new Error(`Сборка не для https://${BUCKET}/ — соберите с SITE_URL=https://${BUCKET}`)
  }
  return files
}

// --- бакет --------------------------------------------------------------------------

/** Ключ → ETag. AWS CLI сам проходит все страницы списка. */
const listBucket = async (): Promise<Map<string, string>> => {
  const { Contents } = await s3api('list-objects-v2')
  const objects = (Contents ?? []) as { Key: string; ETag: string }[]
  return new Map(objects.map((object) => [object.Key, unquote(object.ETag)]))
}

const upload = async (file: BucketFile, dir: string): Promise<void> => {
  const body = join(dir, file.md5)
  writeFileSync(body, file.body)
  const { ETag } = await s3api(
    'put-object',
    ...['--key', file.key, '--body', body],
    ...['--content-type', file.contentType, '--cache-control', file.cacheControl],
    ...(file.contentEncoding ? ['--content-encoding', file.contentEncoding] : []),
  )
  // Иначе следующий деплой не узнает файл и будет перезаливать его каждый раз.
  if (unquote(ETag) !== file.md5) {
    throw new Error(`${file.key}: бакет вернул ETag ${String(ETag)}, ожидали MD5 ${file.md5}`)
  }
}

const remove = async (keys: string[]): Promise<void> => {
  for (let i = 0; i < keys.length; i += DELETE_BATCH) {
    const objects = keys.slice(i, i + DELETE_BATCH).map((Key) => ({ Key }))
    const { Errors } = await s3api(
      'delete-objects',
      ...['--delete', JSON.stringify({ Objects: objects, Quiet: true })],
    )
    if (Array.isArray(Errors) && Errors.length > 0) {
      throw new Error(`Не удалось удалить: ${JSON.stringify(Errors)}`)
    }
  }
}

const inParallel = async <T>(items: T[], task: (item: T) => Promise<void>): Promise<void> => {
  let next = 0
  const worker = async () => {
    while (next < items.length) await task(items[next++]!)
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL, items.length) }, worker))
}

// --- запуск -------------------------------------------------------------------------

const files = readDist()
const plan = deployPlan(files, await listBucket(), force)
const uploads = plan.upload.flat()

for (const file of uploads) console.log(`↑ ${file.key}`)
for (const key of plan.remove) console.log(`✕ ${key}`)

if (!dryRun) {
  const dir = mkdtempSync(join(tmpdir(), 'deploy-bucket-'))
  try {
    for (const queue of plan.upload) await inParallel(queue, (file) => upload(file, dir))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
  await remove(plan.remove)
}

console.log(
  `${dryRun ? 'Без изменений (--dry-run). Было бы: ' : ''}` +
    `загружено ${uploads.length}, удалено ${plan.remove.length}, ` +
    `не изменилось ${plan.unchanged} — бакет ${BUCKET}`,
)
