import type { APIRoute } from 'astro'
import { container } from '../app/container.ts'
import { sitemapPaths, sitemapXml } from '../app/seo.ts'

/** /sitemap.xml — страницы для поиска; адрес сайта — из site в astro.config (SITE_URL). */
export const GET: APIRoute = async ({ site }) => {
  if (!site) throw new Error('sitemap.xml: не задан site в astro.config')
  return new Response(sitemapXml(site, await sitemapPaths(container.lessons)), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
