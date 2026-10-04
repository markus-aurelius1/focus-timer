import { db } from './db'
import type { Settings } from './types'

/** The historical settings shape remains backup-compatible. Removed feature defaults are inert. */
export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  updatedAt: 0,
  theme: 'system',
  weekStartsOn: 1,
  use24h: false,
  activeProfileId: null,
  notifications: true,
  haptics: true,
  keepAwake: true,
  immersiveOnStart: false,
  endSound: 'bell',
  endVolume: 0.7,
  minSessionSeconds: 60,
  ambientFollowsTimer: true,
  atlasStyle: 'physical',
  baseCamp: null,
  breakReview: true,
  immersiveChart: false,
  atlasLayers: { undiscovered: true, areas: true, groups: [] },
  onboarded: false,
}

/** Settings from any version (e.g. an old backup) with legacy keys dropped and new ones defaulted. */
export function normalizeSettings(raw: object): Settings {
  const { skyTheme: _legacy, ...rest } = raw as Record<string, unknown>
  const out = { ...DEFAULT_SETTINGS, ...rest, id: 'settings' } as Settings
  return Object.fromEntries(Object.entries(out).filter(([k]) => k in DEFAULT_SETTINGS)) as unknown as Settings
}

/** Seed only shared settings. Existing legacy records/settings are never removed. */
export async function ensureSeed(): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const existing = await db.settings.get('settings')
    if (existing) {
      const merged = { ...DEFAULT_SETTINGS, ...existing }
      if (Object.keys(merged).length !== Object.keys(existing).length) await db.settings.put(merged)
    } else await db.settings.put({ ...DEFAULT_SETTINGS, updatedAt: Date.now() })
  })
}
