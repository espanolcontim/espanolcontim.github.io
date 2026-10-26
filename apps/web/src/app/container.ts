import { VideosSchema } from '@espanolcontim/content'
import index from '../../../../content/public/index.json'
import videos from '../../../../content/videos.json'
import { StaticLessonRepository } from '../features/lessons/StaticLessonRepository.ts'

/** Композиционный корень: здесь выбираются реализации репозиториев. */

const bodies = import.meta.glob<unknown>('../../../../content/public/lessons/*.json', {
  eager: true,
  import: 'default',
})

export const container = {
  lessons: new StaticLessonRepository(index, Object.values(bodies)),
  videos: VideosSchema.parse(videos),
}
