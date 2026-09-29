/**
 * The motion system. Every animation in the app picks from these, so timing
 * and feel stay consistent. The CSS twins live in index.css (--ease-*, --dur-*).
 *
 *   micro   120–180 ms   hover, press, toggles, small reveals
 *   base    220–260 ms   dialogs, menus, list items, view changes
 *   layout  300–360 ms   sidebar, panels, larger layout shifts
 *
 * Reduced motion: <MotionConfig reducedMotion="user"> (App.tsx) turns transform
 * animations off for Motion; index.css shortens CSS animations/transitions.
 */
import type { Transition } from 'motion/react'

/** Standard deceleration – things arriving. */
export const EASE_OUT = [0.2, 0.8, 0.2, 1] as const
/** Symmetric – things moving from one place to another. */
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const
/** Acceleration – things leaving. */
export const EASE_IN = [0.4, 0, 1, 1] as const

export const DUR = {
  micro: 0.14,
  base: 0.22,
  layout: 0.32,
} as const

export const T = {
  micro: { duration: DUR.micro, ease: EASE_OUT },
  base: { duration: DUR.base, ease: EASE_OUT },
  exit: { duration: DUR.micro, ease: EASE_IN },
  layout: { duration: DUR.layout, ease: EASE_IN_OUT },
  /** Snappy spring for indicators (active tab pill, toggles). */
  indicator: { type: 'spring', stiffness: 520, damping: 40, mass: 0.9 },
  /** Bottom sheets and larger surfaces. */
  sheet: { type: 'spring', stiffness: 420, damping: 40 },
  /** Gentle spring for list items settling. */
  item: { type: 'spring', stiffness: 380, damping: 34 },
} satisfies Record<string, Transition>

/** Fade + small rise, the default way content appears. */
export const rise = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: T.base },
  exit: { opacity: 0, y: -4, transition: T.exit },
}

/** A list row entering / leaving (used with AnimatePresence + layout). */
export const listItem = {
  initial: { opacity: 0, y: 6, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1, transition: T.item },
  exit: { opacity: 0, height: 0, marginTop: 0, marginBottom: 0, transition: { duration: DUR.micro, ease: EASE_IN } },
}

/** Popovers / menus growing out of their anchor. */
export const pop = {
  initial: { opacity: 0, y: -4, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: T.micro },
  exit: { opacity: 0, y: -4, scale: 0.98, transition: T.exit },
}
