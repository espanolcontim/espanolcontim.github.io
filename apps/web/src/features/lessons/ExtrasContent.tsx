import type { Extras } from '@espanolcontim/content'
import { Fragment } from 'react'
import { IpaText } from '../../shared/ui/IpaText.tsx'
import { MarkedText } from '../../shared/ui/MarkedText.tsx'
import styles from './ExtrasContent.module.css'
import { CULTURE_KINDS } from './labels.ts'
import { Dialogue } from './notes/Dialogue.tsx'

/**
 * Дополнительные материалы как текст: выражения, история, фразы, «Испания
 * изнутри», «Ваш ход». Упражнения из них — в подразделе «Упражнения».
 * Бесплатные рисуются при сборке, платные — в браузере (PaidExtras.tsx).
 */
export function ExtrasContent({ extras }: { extras: Extras }) {
  const { expressions, story, phrases, culture, yourTurn } = extras

  return (
    <div className={styles.extras}>
      {expressions.length > 0 && (
        <section className={styles.section} aria-labelledby="expressions">
          <h2 id="expressions">Живые выражения</h2>
          <ul className={styles.list}>
            {expressions.map((expression, i) => (
              <li key={i} className="card">
                <p>
                  <MarkedText text={expression.es} lang="es" className="es big" />{' '}
                  <IpaText ipa={expression.ipa} />
                </p>
                <p className="ru">
                  <MarkedText text={expression.ru} />
                </p>
                {expression.note && <p>{expression.note}</p>}
                {expression.example && (
                  <p className={styles.example}>
                    <MarkedText text={expression.example.es} lang="es" className="es" />
                    <br />
                    <MarkedText text={expression.example.ru} className="ru" />
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section} aria-labelledby="story">
        <h2 id="story">История: {story.title}</h2>
        <Dialogue lines={story.lines} />
        {story.glossary && story.glossary.length > 0 && (
          <p>
            <span className="ru">Новые слова: </span>
            {story.glossary.map((entry, i) => (
              <Fragment key={i}>
                {i > 0 && ', '}
                <span lang="es" className="es">
                  {entry.es}
                </span>{' '}
                — {entry.ru}
              </Fragment>
            ))}
          </p>
        )}
        {story.questions.length > 0 && (
          <div>
            <h3>Вопросы к истории</h3>
            <ol className={styles.questions}>
              {story.questions.map((question, i) => (
                <li key={i}>
                  <span lang="es">{question.question}</span>
                  <details>
                    <summary className={styles.summary}>Ответ</summary>
                    <span lang="es">{question.answer}</span>
                  </details>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      {phrases.length > 0 && (
        <section className={styles.section} aria-labelledby="phrases">
          <h2 id="phrases">Фразы с характером</h2>
          <ul className={styles.phrases}>
            {phrases.map((phrase, i) => (
              <li key={i}>
                <MarkedText text={phrase.es} lang="es" className="es" />{' '}
                <IpaText ipa={phrase.ipa} />
                <br />
                <MarkedText text={phrase.ru} className="ru" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={`${styles.section} ${styles.culture} card`} aria-labelledby="culture">
        <p className="overline">Испания изнутри · {CULTURE_KINDS[culture.kind]}</p>
        <h2 id="culture">{culture.title}</h2>
        {culture.es && (
          <p>
            <span lang="es" className="es big">
              {culture.es}
            </span>{' '}
            <IpaText ipa={culture.ipa} />
            {culture.ru && (
              <>
                <br />
                <span className="ru">{culture.ru}</span>
              </>
            )}
          </p>
        )}
        <p>
          <MarkedText text={culture.text} />
        </p>
      </section>

      <section className={styles.section} aria-labelledby="your-turn">
        <h2 id="your-turn">Ваш ход</h2>
        <p>{yourTurn.task}</p>
        {yourTurn.template && (
          <ul className="chips" aria-label="Начните так">
            {yourTurn.template.map((start, i) => (
              <li key={i} className="chip" lang="es">
                {start}
              </li>
            ))}
          </ul>
        )}
        <details>
          <summary className={styles.summary}>Образец</summary>
          <ul className={styles.phrases}>
            {yourTurn.model.map((phrase, i) => (
              <li key={i}>
                <MarkedText text={phrase.es} lang="es" className="es" />
                <br />
                <MarkedText text={phrase.ru} className="ru" />
              </li>
            ))}
          </ul>
        </details>
      </section>
    </div>
  )
}
