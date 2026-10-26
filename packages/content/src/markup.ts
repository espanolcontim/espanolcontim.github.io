/**
 * Выделение нового прямо в строке: "Quiero **aprender** español." —
 * та же разметка, что в video-lessons. Звёздочки парные, вложенности нет.
 */

export interface MarkedPart {
  text: string
  marked: boolean
}

const MARK = '**'

/** "Quiero **aprender** español." → Quiero · aprender (выделено) · español. */
export function splitMarks(text: string): MarkedPart[] {
  return text
    .split(MARK)
    .map((part, index) => ({ text: part, marked: index % 2 === 1 }))
    .filter((part) => part.text !== '')
}

/** Строка без разметки — для проверки ответа, плашек, title страницы. */
export function plainText(text: string): string {
  return text.split(MARK).join('')
}

/** Нечётное число `**` — выделение не закрыто. */
export function hasUnclosedMark(text: string): boolean {
  return (text.split(MARK).length - 1) % 2 === 1
}
