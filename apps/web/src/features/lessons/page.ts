import { container } from '../../app/container.ts'

/** getStaticPaths для страниц урока: по странице на каждый урок из индекса. */
export async function lessonStaticPaths() {
  const lessons = await container.lessons.list()
  return lessons.map((meta) => ({ params: { id: meta.id } }))
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
