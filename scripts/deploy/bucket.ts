/**
 * Правила выкладки сайта в бакет Object Storage: с какими заголовками лежит
 * каждый файл и что загрузить или удалить. Саму выкладку делает
 * scripts/deploy-bucket.ts.
 *
 * Сравниваем MD5 загружаемого содержимого (для текста — уже сжатого) с ETag
 * в бакете: при обычной загрузке ETag — это и есть MD5. gzip без даты в
 * заголовке, поэтому один и тот же файл каждый раз сжимается в одни и те же байты.
 */
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'

const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  webmanifest: 'application/manifest+json; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  woff2: 'font/woff2',
  woff: 'font/woff',
}

/** Сжимаем только текст: картинки и шрифты уже сжаты. */
const COMPRESSED = new Set(['html', 'css', 'js', 'json', 'webmanifest', 'xml', 'txt', 'svg'])

/** В _astro/ у файлов хэш в имени: изменится содержимое — изменится и имя. */
export const CACHE_IMMUTABLE = 'public, max-age=31536000, immutable'
/** Остальное браузер каждый раз сверяет по ETag — обычно в ответ 304 без тела. */
export const CACHE_REVALIDATE = 'no-cache'

export interface BucketFile {
  key: string
  /** Что кладём в бакет: для текста — сжатое. */
  body: Buffer
  md5: string
  contentType: string
  cacheControl: string
  contentEncoding?: 'gzip'
}

const extension = (key: string): string => {
  const name = key.slice(key.lastIndexOf('/') + 1)
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

/** key — путь от корня сайта без ведущего слэша: lessons/a0-01/index.html. */
export const bucketFile = (key: string, content: Buffer): BucketFile => {
  const ext = extension(key)
  const contentType = TYPES[ext]
  if (contentType === undefined) {
    throw new Error(
      `${key}: неизвестный тип файла — добавьте .${ext} в TYPES (scripts/deploy/bucket.ts)`,
    )
  }
  const compressed = COMPRESSED.has(ext)
  const body = compressed ? gzipSync(content, { level: 9 }) : content
  return {
    key,
    body,
    md5: createHash('md5').update(body).digest('hex'),
    contentType,
    cacheControl: key.startsWith('_astro/') ? CACHE_IMMUTABLE : CACHE_REVALIDATE,
    ...(compressed && { contentEncoding: 'gzip' as const }),
  }
}

export interface DeployPlan {
  /**
   * Очереди загрузки: следующая начинается, когда загружена предыдущая.
   * Сначала _astro/, потом прочие файлы, HTML — последним: пока он грузится,
   * старые страницы ссылаются на старые файлы (они ещё лежат), новые — на уже загруженные.
   */
  upload: BucketFile[][]
  /** Файлы, которых больше нет в сборке; удаляются после загрузки. */
  remove: string[]
  unchanged: number
}

const stage = (file: BucketFile): number =>
  file.key.startsWith('_astro/') ? 0 : extension(file.key) === 'html' ? 2 : 1

/**
 * remote — что лежит в бакете: ключ → ETag без кавычек.
 * force — загрузить всё заново: например, поменялись правила заголовков,
 * а по ETag этого не видно.
 */
export const deployPlan = (
  files: BucketFile[],
  remote: ReadonlyMap<string, string>,
  force = false,
): DeployPlan => {
  const changed = files.filter((file) => force || remote.get(file.key) !== file.md5)
  const upload = [0, 1, 2]
    .map((n) =>
      changed.filter((file) => stage(file) === n).sort((a, b) => a.key.localeCompare(b.key)),
    )
    .filter((queue) => queue.length > 0)
  const local = new Set(files.map((file) => file.key))
  const remove = [...remote.keys()].filter((key) => !local.has(key)).sort()
  return { upload, remove, unchanged: files.length - changed.length }
}
