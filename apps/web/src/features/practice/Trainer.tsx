import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { usePaidBody } from '../lessons/usePaidBody.ts'
import styles from './practice.module.css'
import { Session } from './Session.tsx'
import { SetList, type Locked } from './SetList.tsx'
import { buildPracticeSets, mergeSets, type PracticeSet, type TrainerPlace } from './sets.ts'

/** Запись истории, которую тренажёр добавил сам, открыв набор из списка. */
const FROM_LIST = { practice: 'fromList' }
const openedFromList = () => (history.state as typeof FROM_LIST | null)?.practice === 'fromList'
const hashId = () => location.hash.slice(1) || undefined

/**
 * Тренажёр урока — React-остров подраздела «Упражнения». Открытый набор
 * записан в адресе (#p1, #x2, #quiz): «назад» в браузере и на телефоне
 * возвращает к списку, на проверку можно сослаться прямо. Закрытые наборы
 * подписчику приходят из API и встают в тот же список. Пока набор открыт, у корня —
 * `data-set-open`: по нему страница прячет блок «Дальше».
 */
export default function Trainer({
  lessonId,
  sets: freeSets,
  locked,
  place = 'lesson',
}: {
  lessonId: string
  /** Наборы из бесплатной половины урока. */
  sets: PracticeSet[]
  locked: Locked
  /** На странице практики — свои подписи и адрес возврата после входа. */
  place?: TrainerPlace
}) {
  const [openId, setOpenId] = useState<string>()
  const [returnTo, setReturnTo] = useState<string>()
  const root = useRef<HTMLDivElement>(null)
  const paid = usePaidBody(lessonId, locked.phrases || locked.extras)
  const sets = useMemo(
    () =>
      paid.status === 'ready' ? mergeSets(freeSets, buildPracticeSets(paid.body, place)) : freeSets,
    [freeSets, paid, place],
  )
  const open = sets.find((set) => set.id === openId)

  // Открытый набор и в ref: при возврате к списку фокус встаёт на его ссылку.
  const current = useRef<string>(undefined)
  const show = (id: string | undefined) => {
    if (current.current && !id) setReturnTo(current.current)
    current.current = id
    setOpenId(id)
  }

  useEffect(() => {
    const sync = () => show(hashId())
    sync()
    // popstate — «назад» и «вперёд», hashchange — ссылка с #набором на этой же странице.
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('hashchange', sync)
    }
  }, [])

  useEffect(() => {
    if (open) root.current?.scrollIntoView({ block: 'start' })
  }, [open])

  const openSet = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    // Ctrl/⌘-клик — в новой вкладке, как у обычной ссылки.
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return
    event.preventDefault()
    history.pushState(FROM_LIST, '', `#${id}`)
    show(id)
  }

  const close = () => {
    // Открыли из списка — список в истории прямо за нами, туда и шаг назад.
    if (openedFromList()) {
      history.back()
      return
    }
    history.replaceState(null, '', location.pathname + location.search)
    show(undefined)
  }

  return (
    <div ref={root} className={styles.trainer} data-set-open={open ? '' : undefined}>
      {open ? (
        <Session key={open.id} set={open} lessonId={lessonId} onClose={close} />
      ) : (
        <SetList
          lessonId={lessonId}
          place={place}
          sets={sets}
          locked={locked}
          paid={paid.status === 'ready' ? { status: 'missing' } : paid}
          returnTo={returnTo}
          onOpen={openSet}
        />
      )}
    </div>
  )
}
