// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { clearRouteState, onRouteReset, peekRouteState, rememberScroll, resetRoute, scrollFor, useRouteState } from './routeState'

function Counter({ id, start = 0 }: { id: string; start?: number | (() => number) }) {
  const [n, setN] = useRouteState(id, start)
  return (
    <button type="button" onClick={() => setN((v) => v + 1)}>
      {id}={n}
    </button>
  )
}

afterEach(() => {
  cleanup()
  clearRouteState()
})

describe('useRouteState', () => {
  it('keeps its value across unmount and remount', () => {
    const first = render(<Counter id="calendar:n" />)
    act(() => screen.getByRole('button').click())
    act(() => screen.getByRole('button').click())
    expect(screen.getByRole('button').textContent).toBe('calendar:n=2')
    first.unmount()
    render(<Counter id="calendar:n" />)
    expect(screen.getByRole('button').textContent).toBe('calendar:n=2')
    expect(peekRouteState('calendar:n')).toBe(2)
  })

  it('keeps two components on the same key in step, and different keys apart', () => {
    render(
      <>
        <Counter id="insights:a" />
        <Counter id="insights:a" />
        <Counter id="insights:b" start={10} />
      </>,
    )
    const [one, two, other] = screen.getAllByRole('button')
    act(() => one.click())
    expect(one.textContent).toBe('insights:a=1')
    expect(two.textContent).toBe('insights:a=1')
    expect(other.textContent).toBe('insights:b=10')
  })

  it('resetting a route returns its state to the defaults, live, and leaves other routes alone', () => {
    let seeds = 0
    render(
      <>
        <Counter id="tasks:filter" start={() => 5 + seeds++ * 0} />
        <Counter id="calendar:view" />
      </>,
    )
    const [tasks, calendar] = screen.getAllByRole('button')
    act(() => tasks.click())
    act(() => calendar.click())
    rememberScroll('tasks', 480)
    rememberScroll('calendar', 120)
    const seen: string[] = []
    const off = onRouteReset((r) => seen.push(r))
    act(() => resetRoute('tasks'))
    off()
    expect(tasks.textContent).toBe('tasks:filter=5')
    expect(calendar.textContent).toBe('calendar:view=1')
    expect(scrollFor('tasks')).toBe(0)
    expect(scrollFor('calendar')).toBe(120)
    expect(seen).toEqual(['tasks'])
    // The lazy default was computed once per mount, not again on reset.
    expect(seeds).toBe(1)
  })

  it('a route name that is a prefix of another does not reset it', () => {
    render(
      <>
        <Counter id="notes:view" />
        <Counter id="notes-archive:view" />
      </>,
    )
    const [a, b] = screen.getAllByRole('button')
    act(() => a.click())
    act(() => b.click())
    act(() => resetRoute('notes'))
    expect(a.textContent).toBe('notes:view=0')
    expect(b.textContent).toBe('notes-archive:view=1')
  })
})
