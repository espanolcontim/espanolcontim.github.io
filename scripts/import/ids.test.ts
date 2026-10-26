import { describe, expect, it } from 'vitest'
import { lessonIds, normalizeForKey, sentenceKey, type IdsLock } from './ids.ts'

const phrase = (ru: string, es: string, hint?: string) =>
  sentenceKey(hint === undefined ? { ru, es } : { ru, es, hint })

describe('normalizeForKey', () => {
  it('убирает разметку, регистр, диакритику и пунктуацию', () => {
    expect(normalizeForKey('¿**De dónde** eres?')).toBe('de donde eres')
    expect(normalizeForKey('  Mañana,  tengo   que…')).toBe('manana tengo que')
  })
})

describe('sentenceKey', () => {
  it('правка пунктуации и выделения ключ не меняет', () => {
    expect(phrase('Где ты живёшь?', '¿**Dónde** vives?')).toBe(
      phrase('Где ты живёшь', 'Donde vives'),
    )
  })

  it('уточнение — часть задания', () => {
    expect(phrase('Добрый день.', 'Buenos días.', 'в 11 утра')).not.toBe(
      phrase('Добрый день.', 'Buenos días.'),
    )
  })
})

describe('LessonIds', () => {
  const keys = ['a', 'b', 'c', 'd']

  it('новые фразы получают номера по порядку', () => {
    const lock: IdsLock = { version: 1, lessons: {} }
    const ids = lessonIds(lock, 'a0-01')
    expect(keys.slice(0, 3).map((key) => ids.sentence(key))).toEqual([1, 2, 3])
    expect(ids.added.sentences).toEqual([1, 2, 3])
    expect(lock.lessons['a0-01']?.sentences).toEqual({ a: 1, b: 2, c: 3 })
  })

  it('вставка в середину не сдвигает старые номера, удалённые не переиспользуются', () => {
    const lock: IdsLock = {
      version: 1,
      lessons: { 'a0-01': { sentences: { a: 1, b: 2, c: 3 }, exercises: {} } },
    }
    const ids = lessonIds(lock, 'a0-01')
    // b удалили, d вставили перед c
    expect(['a', 'd', 'c'].map((key) => ids.sentence(key))).toEqual([1, 4, 3])
    expect(ids.added.sentences).toEqual([4])
    expect(ids.unused().sentences).toEqual([2])
  })

  it('упражнения нумеруются отдельно от предложений', () => {
    const ids = lessonIds({ version: 1, lessons: {} }, 'a0-01')
    ids.sentence('a')
    expect(ids.exercise('a')).toBe(1)
  })
})
