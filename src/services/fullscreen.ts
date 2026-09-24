import { StatusBar } from '@capacitor/status-bar'
import { isNative } from '@/lib/platform'

export async function enterFullscreen(): Promise<void> {
  if (isNative) {
    await StatusBar.hide().catch(() => {})
    return
  }
  const el = document.documentElement
  if (!document.fullscreenElement && el.requestFullscreen) {
    await el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {})
  }
}

export async function exitFullscreen(): Promise<void> {
  if (isNative) {
    await StatusBar.show().catch(() => {})
    return
  }
  if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen().catch(() => {})
}
