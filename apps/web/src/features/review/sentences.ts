import type { LessonRepository } from '../lessons/LessonRepository.ts'
import { translateTask } from '../practice/sets.ts'
import type { ReviewSentence } from './session.ts'

/**
 * Фразы, которые могут встретиться в повторении: все предложения доступных
 * уроков, задание — перевод на испанский. В повторение из них попадает
 * только то, что ученик решал в упражнениях.
 */
export async function reviewSentences(lessons: LessonRepository): Promise<ReviewSentence[]> {
  const sentences: ReviewSentence[] = []
  for (const meta of await lessons.list()) {
    const body = await lessons.getBody(meta.id)
    for (const sentence of body?.sentences ?? []) {
      sentences.push({
        id: sentence.id,
        task: translateTask(sentence),
        lesson: `Урок ${meta.number}`,
      })
    }
  }
  return sentences
}
