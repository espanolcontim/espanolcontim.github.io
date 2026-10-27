import {
  sentenceExerciseId,
  type Exercise,
  type LessonBody,
  type Sentence,
} from '@espanolcontim/content'

/**
 * Наборы упражнений подраздела «Упражнения»: группы фраз урока, блоки из
 * дополнительных материалов и проверка после урока. Собираются при сборке
 * сайта и уходят в тренажёр готовыми заданиями — с текстом, без ссылок.
 */

/** Задание на предложении: задание по-русски, верные ответы — первый эталон. */
interface SentenceFields {
  id: string
  /** Предложение — по нему фраза попадает в повторение. */
  sentenceId: string
  ru: string
  hint?: string | undefined
  answers: string[]
  ipa?: string | undefined
  why?: string | undefined
}

export type Task =
  /** RU → ES. */
  | ({ kind: 'translate' } & SentenceFields)
  /** Собрать фразу из плашек. */
  | ({ kind: 'order' } & SentenceFields)
  /** Найдите ошибку: ученик исправляет фразу. */
  | ({ kind: 'fix'; wrong: string } & SentenceFields)
  /** Вставьте слово: выбор из вариантов. */
  | {
      kind: 'gap'
      id: string
      text: string
      answer: string
      options: string[]
      ru?: string | undefined
    }
  /** ES → RU с самопроверкой. */
  | { kind: 'read'; id: string; es: string; ru: string }

export type SetKind = 'phrases' | 'extras' | 'quiz'

export interface PracticeSet {
  /** Он же в адресе: #p1, #x2, #quiz. */
  id: string
  kind: SetKind
  title: string
  tasks: Task[]
}

export const QUIZ_TITLE = 'Проверка после урока'

const sentenceFields = (id: string, sentence: Sentence): SentenceFields => ({
  id,
  sentenceId: sentence.id,
  ru: sentence.ru,
  hint: sentence.hint,
  answers: sentence.es,
  ipa: sentence.ipa,
  why: sentence.why,
})

/** Перевод предложения на испанский — так фразы урока идут в тренажёр и в повторение. */
export function translateTask(sentence: Sentence): Task {
  return {
    kind: 'translate',
    ...sentenceFields(sentenceExerciseId(sentence.id, 'translate'), sentence),
  }
}

/** Предложение задания, если оно есть: «вставьте слово» и самопроверка — без него. */
export const taskSentence = (task: Task): string | undefined =>
  'sentenceId' in task ? task.sentenceId : undefined

export function buildPracticeSets(body: LessonBody): PracticeSet[] {
  const sentences = new Map(body.sentences.map((sentence) => [sentence.id, sentence]))
  const sentence = (id: string): Sentence => {
    const found = sentences.get(id)
    if (!found) throw new Error(`урок ${body.id}: нет предложения ${id}`)
    return found
  }

  const task = (exercise: Exercise): Task => {
    switch (exercise.type) {
      case 'translate':
      case 'order':
        return {
          kind: exercise.type,
          ...sentenceFields(exercise.id, sentence(exercise.sentenceId)),
        }
      case 'fix':
        return {
          kind: 'fix',
          wrong: exercise.wrong,
          ...sentenceFields(exercise.id, sentence(exercise.sentenceId)),
        }
      case 'gap': {
        const { id, text, answer, options, ru } = exercise
        return { kind: 'gap', id, text, answer, options, ru }
      }
      case 'read':
        return { kind: 'read', id: exercise.id, es: exercise.es, ru: exercise.ru }
    }
  }

  const phrases: PracticeSet[] = (body.practice ?? []).map((group, i) => ({
    id: `p${i + 1}`,
    kind: 'phrases',
    title: group.name,
    tasks: group.sentenceIds.map((id) => translateTask(sentence(id))),
  }))

  const extras: PracticeSet[] = (body.extras?.exercises ?? []).map((block, i) => ({
    id: `x${i + 1}`,
    kind: 'extras',
    title: block.title,
    tasks: block.items.map(task),
  }))

  const quiz: PracticeSet[] = body.quiz
    ? [{ id: 'quiz', kind: 'quiz', title: QUIZ_TITLE, tasks: body.quiz.map(task) }]
    : []

  return [...phrases, ...extras, ...quiz]
}
