import { splitMarks } from '@espanolcontim/content'

/** Текст урока с выделением нового — то же, что Marked.astro, для React-островов. */
export function MarkedText({
  text,
  lang,
  className,
}: {
  text: string
  /** Испанский текст — с lang="es": так его правильно читают экранные читалки. */
  lang?: 'es' | undefined
  className?: string | undefined
}) {
  return (
    <span lang={lang} className={className}>
      {splitMarks(text).map((part, i) =>
        part.marked ? (
          <strong key={i} className="mark">
            {part.text}
          </strong>
        ) : (
          part.text
        ),
      )}
    </span>
  )
}
