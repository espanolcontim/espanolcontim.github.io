import { describe, expect, it } from 'vitest'
import {
  EXERCISE_ID,
  extraExerciseId,
  LESSON_ID,
  lessonId,
  practiceId,
  SENTENCE_ID,
  sentenceLesson,
  sentenceExerciseId,
  sentenceId,
} from './ids.ts'

describe('id контента', () => {
  it('урок: уровень строчными и номер в уровне с ведущим нулём', () => {
    expect(lessonId({ level: 'A0', planLesson: 1 })).toBe('a0-01')
    expect(lessonId({ level: 'A1', planLesson: 25 })).toBe('a1-25')
  })

  it('практика: уровень и «p» с номером практики в уровне, без ведущего нуля', () => {
    expect(practiceId({ level: 'A0', planLesson: 1 })).toBe('a0-p1')
    expect(practiceId({ level: 'A1', planLesson: 12 })).toBe('a1-p12')
    expect(sentenceLesson(sentenceId('a0-p1', 3))).toBe('a0-p1')
  })

  it('предложение и упражнения', () => {
    const sentence = sentenceId('a0-11', 7)
    expect(sentence).toBe('a0-11-s07')
    expect(sentenceId('a0-11', 104)).toBe('a0-11-s104')
    expect(sentenceExerciseId(sentence, 'order')).toBe('a0-11-s07.order')
    expect(extraExerciseId('a0-11', 5)).toBe('a0-11-x05')
  })

  it('регулярные выражения принимают свои id и только их', () => {
    expect(LESSON_ID.test('a0-11')).toBe(true)
    expect(LESSON_ID.test('A0-11')).toBe(false)
    expect(SENTENCE_ID.test('a0-11-s07')).toBe(true)
    expect(SENTENCE_ID.test('a0-11-x07')).toBe(false)
    expect(EXERCISE_ID.test('a0-11-s07.translate')).toBe(true)
    expect(EXERCISE_ID.test('a0-11-x05')).toBe(true)
    expect(EXERCISE_ID.test('a0-11-s07.choice')).toBe(false)
    expect(LESSON_ID.test('a0-p1')).toBe(true)
    expect(LESSON_ID.test('a0-p')).toBe(false)
    expect(SENTENCE_ID.test('a0-p1-s07')).toBe(true)
    expect(EXERCISE_ID.test('a0-p1-s07.order')).toBe(true)
  })
})
