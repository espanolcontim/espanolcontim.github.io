import { lessonPath } from './navigation.ts'
import { NotesContent } from './NotesContent.tsx'
import { PaidNotice } from './PaidNotice.tsx'
import { usePaidBody } from './usePaidBody.ts'

/** Платный конспект — React-остров: подписчику приходит из API, остальным — плашка. */
export default function PaidNotes({ lessonId, inside }: { lessonId: string; inside: string }) {
  const paid = usePaidBody(lessonId)
  if (paid.status === 'ready' && paid.body.notes) return <NotesContent notes={paid.body.notes} />
  return (
    <PaidNotice
      paid={paid.status === 'ready' ? { status: 'missing' } : paid}
      inside={inside}
      from={lessonPath(lessonId, 'notes')}
    />
  )
}
