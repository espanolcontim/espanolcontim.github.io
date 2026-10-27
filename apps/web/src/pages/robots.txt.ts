import type { APIRoute } from 'astro'
import { robotsTxt } from '../app/seo.ts'

/** /robots.txt — всё открыто, ссылка на sitemap. */
export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error('robots.txt: не задан site в astro.config')
  return new Response(robotsTxt(site), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
