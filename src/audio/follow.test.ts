import { describe, expect, it } from 'vitest'
import { followAction } from './followAction'

const t = (status: 'idle' | 'running' | 'paused', phase: 'focus' | 'shortBreak' | 'longBreak' = 'focus') => ({ status, phase })

describe('sound follows the timer', () => {
  it('plays when focus starts or resumes', () => {
    expect(followAction(t('idle'), t('running'))).toBe('play')
    expect(followAction(t('paused'), t('running'))).toBe('play')
    expect(followAction(t('running', 'shortBreak'), t('running'))).toBe('play')
  })

  it('pauses when focus is paused or a break begins', () => {
    expect(followAction(t('running'), t('paused'))).toBe('pause')
    expect(followAction(t('running'), t('running', 'shortBreak'))).toBe('pause')
    expect(followAction(t('running'), t('running', 'longBreak'))).toBe('pause')
  })

  it('stops on stop, reset or a phase ending without auto-start – also from a paused timer', () => {
    expect(followAction(t('running'), t('idle'))).toBe('stop')
    expect(followAction(t('paused'), t('idle'))).toBe('stop')
    expect(followAction(t('running'), t('idle', 'shortBreak'))).toBe('stop')
    expect(followAction(t('running', 'shortBreak'), t('idle'))).toBe('stop')
  })

  it('does nothing when nothing relevant changed', () => {
    expect(followAction(t('idle'), t('idle', 'shortBreak'))).toBeNull()
    expect(followAction(t('running'), t('running'))).toBeNull()
    expect(followAction(t('paused'), t('paused'))).toBeNull()
    expect(followAction(t('running', 'shortBreak'), t('paused', 'shortBreak'))).toBeNull()
  })
})
