/** Обязательная переменная окружения функции: без неё — понятная ошибка в логах, а не undefined. */
export const requireEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) throw new Error(`Не задана переменная окружения ${name}`)
  return value
}
