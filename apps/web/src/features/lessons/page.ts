import { container } from '../../app/container.ts'
import { lessonSections, type LessonSection } from './navigation.ts'

/** getStaticPaths для страниц урока: по странице на каждый урок из индекса. */
export async function lessonStaticPaths() {
  const lessons = await container.lessons.list()
  return lessons.map((meta) => ({ params: { id: meta.id } }))
}

/** getStaticPaths подраздела: только у уроков, где он есть (у практики подразделов нет). */
export async function sectionStaticPaths(section: LessonSection) {
  const lessons = await container.lessons.list()
  return lessons
    .filter((meta) => lessonSections(meta).includes(section))
    .map((meta) => ({ params: { id: meta.id } }))
}

/** Всё, что нужно странице урока или подраздела. */
export async function loadLesson(id: string | undefined) {
  const meta = id ? await container.lessons.getMeta(id) : undefined
  const body = id ? await container.lessons.getBody(id) : undefined
  if (!meta || !body) throw new Error(`урок ${String(id)}: нет в content/public`)
  return {
    meta,
    body,
    lessons: await container.lessons.list(),
    channel: container.videos.channel,
  }
}
