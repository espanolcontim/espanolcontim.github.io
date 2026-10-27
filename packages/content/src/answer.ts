import { plainText } from './markup.ts'

/**
 * Проверка ответа ученика — одна на тренажёр, повторение и проверку после урока.
 *
 * - Верных ответов несколько, первый — эталон (es + alternatives).
 * - Регистр, пробелы, пунктуация и знаки ¿ ¡ не важны.
 * - Не те знаки над буквами (á é í ó ú ü ñ) — «почти верно» и подсказка, в каких словах.
 * - «Найдите ошибку»: если ошибка была как раз в знаке над буквой или в ¿ ¡,
 *   исправить нужно именно её — иначе засчитали бы фразу, оставленную как была.
 */

export type Verdict = 'correct' | 'almost' | 'wrong'

export interface AnswerCheck {
  verdict: Verdict
  /** Верный ответ, с которым совпало; при ошибке — эталон. С разметкой, как в данных. */
  answer: string
  /** «Почти верно»: слова ответа, где знаки над буквами не те, — как в ответе: días, España. */
  accents: string[]
  /** «Найдите ошибку»: фразу оставили как была. */
  unchanged: boolean
}

export interface CheckOptions {
  /** «Найдите ошибку»: фраза с ошибкой, которую ученик исправляет. */
  wrong?: string | undefined
}

const INVERTED = new Set(['¿', '¡'])

/** Слова и знаки ¿ ¡ по порядку: «Hola. ¿De dónde eres?» → Hola · ¿ · De · dónde · eres. */
function tokenize(text: string): string[] {
  return plainText(text)
    .normalize('NFC')
    .replace(/[¿¡]/gu, ' $& ')
    .split(/[^\p{L}\p{N}¿¡]+/u)
    .filter((token) => token !== '')
}

const wordsOf = (tokens: string[]): string[] => tokens.filter((token) => !INVERTED.has(token))
const lower = (word: string): string => word.toLocaleLowerCase('es')
/** Без регистра и знаков над буквами: Días → dias, España → espana. */
const bare = (word: string): string =>
  lower(word)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
const key = (tokens: string[], fold: (word: string) => string): string =>
  tokens.map(fold).join(' ')

/** Плашки «собери фразу»: слова ответа как написаны, без пунктуации и ¿ ¡. */
export function orderTiles(answer: string): string[] {
  return wordsOf(tokenize(answer))
}

/**
 * Сравнение с одним верным ответом. given, expected и wrong — токены,
 * ¿ ¡ в них отдельными токенами.
 */
function compare(
  given: string[],
  expected: string[],
  wrong: string[] | undefined,
): { verdict: Verdict; accents: string[] } {
  const givenWords = wordsOf(given)
  const expectedWords = wordsOf(expected)
  if (key(givenWords, bare) !== key(expectedWords, bare)) return { verdict: 'wrong', accents: [] }

  // «Найдите ошибку», где фраза с ошибкой отличается только знаками.
  if (wrong && key(wordsOf(wrong), bare) === key(expectedWords, bare)) {
    // Ошибка в ¿ ¡ — они обязательны.
    if (key(wrong, bare) !== key(expected, bare) && key(given, bare) !== key(expected, bare)) {
      return { verdict: 'wrong', accents: [] }
    }
    // Ошибка в знаке над буквой — в этих словах он обязателен.
    const wrongWords = wordsOf(wrong)
    const fixed = expectedWords.every(
      (word, i) =>
        lower(word) === lower(wrongWords[i] ?? '') || lower(word) === lower(givenWords[i] ?? ''),
    )
    if (!fixed) return { verdict: 'wrong', accents: [] }
  }

  const accents = expectedWords.filter((word, i) => lower(word) !== lower(givenWords[i] ?? ''))
  return { verdict: accents.length > 0 ? 'almost' : 'correct', accents }
}

/**
 * Проверяет ответ: «верно», «почти верно» (не те знаки над буквами) или «неверно».
 * @param answers верные ответы, первый — эталон
 */
export function checkAnswer(
  input: string,
  answers: readonly string[],
  options: CheckOptions = {},
): AnswerCheck {
  const given = tokenize(input)
  const wrong = options.wrong === undefined ? undefined : tokenize(options.wrong)
  let almost: AnswerCheck | undefined

  for (const answer of answers) {
    const { verdict, accents } = compare(given, tokenize(answer), wrong)
    if (verdict === 'correct') return { verdict, answer, accents, unchanged: false }
    if (verdict === 'almost') almost ??= { verdict, answer, accents, unchanged: false }
  }
  if (almost) return almost

  return {
    verdict: 'wrong',
    answer: answers[0] ?? '',
    accents: [],
    unchanged: wrong !== undefined && given.length > 0 && key(given, lower) === key(wrong, lower),
  }
}
