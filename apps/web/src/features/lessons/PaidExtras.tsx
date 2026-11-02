import { ExtrasContent } from './ExtrasContent.tsx'
import { lessonPath } from './navigation.ts'
import { PaidNotice } from './PaidNotice.tsx'
import { usePaidBody } from './usePaidBody.ts'

/** Платные дополнительные материалы — React-остров: подписчику приходят из API, остальным — плашка. */
export default function PaidExtras({ lessonId, inside }: { lessonId: string; inside: string }) {
  const paid = usePaidBody(lessonId)
  if (paid.status === 'ready' && paid.body.extras) {
    return <ExtrasContent extras={paid.body.extras} />
  }
  return (
    <PaidNotice
      paid={paid.status === 'ready' ? { status: 'missing' } : paid}
      inside={inside}
      from={lessonPath(lessonId, 'extras')}
    />
  )
}
