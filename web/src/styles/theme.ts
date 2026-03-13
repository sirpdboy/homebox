import { ThemeVar } from './variable'


export const BaseTheme: Record<ThemeVar, string> = {
  [ThemeVar.BackendColor]: 'rgba(50,50,50,0.03)'
}

export const LightTheme = BaseTheme
export const DarkTheme = BaseTheme
