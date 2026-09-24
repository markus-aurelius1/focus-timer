import { useEffect } from 'react'
import { StatusBar, Style } from '@capacitor/status-bar'
import type { ThemePreference } from '@/data/types'
import { isNative } from '@/lib/platform'
import { useMediaQuery } from '@/ui/useMedia'

export function useResolvedDark(pref: ThemePreference): boolean {
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  return pref === 'dark' || (pref === 'system' && systemDark)
}

/** Apply the theme class, browser chrome colour and native status bar style. */
export function useApplyTheme(pref: ThemePreference, override?: 'dark' | null) {
  const dark = useResolvedDark(pref) || override === 'dark'
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    const color = dark ? '#0a0c14' : '#f4f0e7'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
    try {
      localStorage.setItem('lodestar.theme', pref)
    } catch {
      /* ignore */
    }
    if (isNative) {
      void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {})
      void StatusBar.setBackgroundColor({ color }).catch(() => {})
    }
  }, [dark, pref])
  return dark
}
