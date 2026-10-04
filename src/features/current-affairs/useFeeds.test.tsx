/** Refresh cancellation must not abort completed responses still being copied by the service worker. */
// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useFeeds } from './useFeeds'

vi.mock('@/lib/useOnline', () => ({ useOnline: () => true }))
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('keeps completed feed response signals alive across refresh and unmount', async () => {
  const signals: AbortSignal[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/current-affairs') signals.push(init!.signal as AbortSignal)
    return new Response(JSON.stringify(url === '/api/current-affairs'
      ? { version: 1, fetchedAt: new Date().toISOString(), items: [], sources: [] }
      : { version: 1, signals: [] }), { status: 200 })
  }))
  const hook = renderHook(useFeeds)
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  act(() => hook.result.current.reload())
  await waitFor(() => expect(signals).toHaveLength(2))
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  expect(signals.map(signal => signal.aborted)).toEqual([false, false])
  hook.unmount()
  expect(signals.map(signal => signal.aborted)).toEqual([false, false])
})

it('still aborts unfinished requests when the News screen unmounts', () => {
  let signal: AbortSignal | undefined
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/current-affairs') signal = init!.signal as AbortSignal
    return new Promise(() => {})
  }))
  const hook = renderHook(useFeeds)
  expect(signal?.aborted).toBe(false)
  hook.unmount()
  expect(signal?.aborted).toBe(true)
})
