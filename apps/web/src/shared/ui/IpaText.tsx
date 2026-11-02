/** Транскрипция в квадратных скобках; нет транскрипции — ничего. */
export function IpaText({ ipa }: { ipa?: string | undefined }) {
  return ipa ? <span className="ipa">[{ipa}]</span> : null
}
