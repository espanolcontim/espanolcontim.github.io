/**
 * Транскрипция слов из `newVocabulary` — как в полном PDF-конспекте
 * (video-lessons, scripts/lesson-pdf.ts): у слова своей `ipa` обычно нет,
 * она берётся из фраз уроков.
 */
import { plainText } from '@espanolcontim/content'
import type { LessonSource } from './source.ts'

/**
 * «¿Cómo te llamas?» и «cómo te llamas» — одно и то же. Тире тоже убираем:
 * в «vender — Vendo un coche.» слов столько же, сколько в «benˈdeɾ · ˈbendo un ˈkotʃe».
 */
const wordKey = (text: string): string =>
  plainText(text)
    .toLowerCase()
    .replace(/[¿?¡!.,…—]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** Фразы урока с транскрипцией; таблицы первыми — это новые слова. */
function phrasesWithIpa(lesson: LessonSource): { es: string; ipa: string }[] {
  const tables: { es: string; ipa?: string | undefined }[] = []
  const rest: { es: string; ipa?: string | undefined }[] = []
  for (const slide of lesson.slides) {
    if (slide.type === 'table') tables.push(...slide.rows)
    if (slide.type === 'rule') rest.push(...slide.examples)
    if (slide.type === 'practice') rest.push(slide.phrase)
    if (slide.type === 'compare') rest.push(...slide.left.items, ...slide.right.items)
    if (slide.type === 'conjugation') {
      rest.push(...slide.rows.map((row) => ({ es: row.stem + row.ending, ipa: row.ipa })))
    }
    if (slide.type === 'conjugationCompare') {
      rest.push(
        ...slide.rows.flatMap((row) =>
          row.forms.map((form) => ({ es: form.stem + form.ending, ipa: form.ipa })),
        ),
      )
    }
  }
  return [...tables, ...rest].filter((p): p is { es: string; ipa: string } => Boolean(p.ipa))
}

/**
 * Поиск транскрипции слова: сначала фраза целиком («¿Cómo te llamas?»),
 * иначе по словам — «el / la estudiante» собирается из отдельных слов.
 * Слово фразы сопоставляется слову `ipa`, только если их число совпадает.
 * Уроки просматриваются по порядку: первым передайте сам урок.
 */
export function ipaLookup(lessons: LessonSource[]): (es: string) => string | undefined {
  const phrases = new Map<string, string>()
  const words = new Map<string, string>()
  for (const phrase of lessons.flatMap(phrasesWithIpa)) {
    const key = wordKey(phrase.es)
    if (!phrases.has(key)) phrases.set(key, phrase.ipa)
    const esWords = key.split(/\s+/)
    const ipaWords = phrase.ipa.replaceAll('·', ' ').split(/\s+/).filter(Boolean)
    if (esWords.length !== ipaWords.length) continue
    esWords.forEach((word, i) => {
      if (!words.has(word)) words.set(word, ipaWords[i]!)
    })
  }
  return (es) => {
    const whole = phrases.get(wordKey(es))
    if (whole) return whole
    // «el / la estudiante», «el programador, la programadora»: разделители как есть
    const parts = es
      .toLowerCase()
      .split(/(\s*[/,]\s*|\s+)/)
      .filter(Boolean)
      .map((part) => (/^\s*[/,]?\s*$/.test(part) ? part : words.get(wordKey(part))))
    return parts.every((part) => part !== undefined) ? parts.join('') : undefined
  }
}
