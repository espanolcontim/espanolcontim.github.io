import type { LessonBody, LessonMeta } from '@espanolcontim/content'
import type { LessonRepository } from '../features/lessons/LessonRepository.ts'
import { lessonPath } from '../features/lessons/navigation.ts'

/** Поиск и превью ссылок: sitemap, описания страниц, Open Graph. */

export const SITE_NAME = 'Español con Tim'

/**
 * Подтверждение прав в Яндекс Вебмастере — значение content из мета-тега
 * `<meta name="yandex-verification" content="…">`. Пока пусто — тега нет.
 */
export const YANDEX_VERIFICATION = '8ade9113bcce30a3'

/** Сколько символов описания Яндекс показывает в сниппете. */
export const DESCRIPTION_LIMIT = 160

/**
 * Описание из начала и пунктов через «; », не длиннее limit: пункты берутся
 * целиком, пока влезают. Если не влез ни один — запасной текст.
 */
export function fitDescription(
  start: string,
  items: readonly string[],
  fallback: string,
  limit = DESCRIPTION_LIMIT,
): string {
  let text = ''
  for (const item of items) {
    const next = text ? `${text}; ${item}` : item
    if (`${start}${next}.`.length > limit) break
    text = next
  }
  return `${start}${text || fallback}.`
}

/**
 * Страницы урока для поиска. Закрытые конспект и допматериалы — заглушки
 * с noindex (их тела нет в content/public), в sitemap их нет.
 */
export function lessonSitemapPaths(meta: LessonMeta, body: LessonBody): string[] {
  return [
    lessonPath(meta.id),
    ...(body.notes ? [lessonPath(meta.id, 'notes')] : []),
    ...(body.extras ? [lessonPath(meta.id, 'extras')] : []),
    lessonPath(meta.id, 'practice'),
  ]
}

/** Все страницы для sitemap.xml. Повторения нет: это личная страница, у неё noindex. */
export async function sitemapPaths(lessons: LessonRepository): Promise<string[]> {
  const paths = ['/', '/lessons/']
  for (const meta of await lessons.list()) {
    const body = await lessons.getBody(meta.id)
    if (body) paths.push(...lessonSitemapPaths(meta, body))
  }
  return paths
}

const escapeXml = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

export function sitemapXml(site: URL, paths: readonly string[]): string {
  const urls = paths.map((path) => `  <url><loc>${escapeXml(new URL(path, site).href)}</loc></url>`)
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
}

export function robotsTxt(site: URL): string {
  return [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${new URL('/sitemap.xml', site).href}`,
    '',
  ].join('\n')
}
