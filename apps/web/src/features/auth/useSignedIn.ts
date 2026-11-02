import { useSyncExternalStore } from 'react'
import { auth } from '../../app/browser.ts'

const subscribe = (listener: () => void) => auth.subscribe(listener)
const signedIn = () => auth.session() !== undefined
/** При сборке страницы хранилища нет: разметка — как у гостя. */
const atBuild = () => false

/** Вошёл ли ученик на этом устройстве. */
export function useSignedIn(): boolean {
  return useSyncExternalStore(subscribe, signedIn, atBuild)
}
