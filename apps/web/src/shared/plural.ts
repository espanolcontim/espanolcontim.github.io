/** «1 фраза», «3 фразы», «12 фраз»: формы для 1, 2–4 и 5+. */
export function plural(n: number, [one, few, many]: readonly [string, string, string]): string {
  const tens = n % 100
  const units = n % 10
  const form =
    tens >= 11 && tens <= 14 ? many : units === 1 ? one : units >= 2 && units <= 4 ? few : many
  return `${n} ${form}`
}
