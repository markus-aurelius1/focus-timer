import { create } from 'zustand'
import { uid } from '@/lib/id'

export type ToastTone = 'default' | 'success' | 'warning' | 'celebrate'

export interface Toast {
  id: string
  title: string
  body?: string
  tone: ToastTone
  duration: number
  action?: { label: string; run: () => void }
}

interface ToastStore {
  toasts: Toast[]
  push: (t: Omit<Toast, 'id' | 'tone' | 'duration'> & Partial<Pick<Toast, 'tone' | 'duration'>>) => string
  dismiss: (id: string) => void
}

export const useToasts = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => {
    const id = uid()
    // Toasts that offer an action (Undo, Reload…) stay a little longer.
    const toastItem: Toast = { tone: 'default', duration: t.action ? 6500 : 4200, ...t, id }
    set((s) => ({ toasts: [...s.toasts.slice(-2), toastItem] }))
    if (toastItem.duration > 0) setTimeout(() => useToasts.getState().dismiss(id), toastItem.duration)
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = (t: Parameters<ToastStore['push']>[0]) => useToasts.getState().push(t)
