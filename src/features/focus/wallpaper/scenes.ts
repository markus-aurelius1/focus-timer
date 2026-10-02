/**
 * Focus wallpapers, drawn by code.
 *
 * Every wallpaper is an illustration generated from a scene family, a palette
 * and a seed: layered skies, skylines, ridges, rooms and weather built from a
 * few dozen shapes. They are original to Tars (no third-party artwork, nothing
 * to license or download), weigh nothing until one is shown, and are the same
 * on every device because the randomness is seeded.
 *
 * `WALLPAPERS` lists them (id, name, category); `renderWallpaper(id)` returns
 * the SVG for one. The module is loaded on demand by the Focus screen.
 */

const W = 1600
const H = 900

type Rand = () => number
/** mulberry32: small, fast, good enough for scenery. */
const rng = (seed: number): Rand => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
const n = (v: number) => (Math.round(v * 10) / 10).toString()
const between = (r: Rand, a: number, b: number) => a + (b - a) * r()
const pick = <T,>(r: Rand, list: readonly T[]): T => list[Math.floor(r() * list.length)]

export interface Palette {
  /** Sky, top to bottom. */
  sky: [string, string, string]
  /** The sun, moon or lamp, and the haze around it. */
  light: string
  glow: string
  /** Scenery, far to near. */
  far: string
  mid: string
  near: string
  /** Windows, lamps, reflections. */
  warm: string
  /** A second, cooler accent (neon, water highlights). */
  cool: string
}

// ── shared pieces ───────────────────────────────────────────────────────────

const sky = (p: Palette, id = 'sky') =>
  `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky[0]}"/><stop offset="0.55" stop-color="${p.sky[1]}"/><stop offset="1" stop-color="${p.sky[2]}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#${id})"/>`

const stars = (r: Rand, count: number, maxY: number, color = '#fff') => {
  let s = ''
  for (let i = 0; i < count; i++) {
    const big = r() > 0.92
    s += `<circle cx="${n(r() * W)}" cy="${n(r() * maxY)}" r="${big ? n(between(r, 1.6, 2.4)) : n(between(r, 0.6, 1.3))}" fill="${color}" opacity="${n(between(r, 0.25, big ? 0.95 : 0.7))}"/>`
  }
  return s
}

/** A sun or moon with a soft halo. */
const orb = (x: number, y: number, rad: number, color: string, glow: string, id: string, halo = 5) =>
  `<defs><radialGradient id="${id}"><stop offset="0" stop-color="${glow}" stop-opacity="0.75"/><stop offset="0.35" stop-color="${glow}" stop-opacity="0.28"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient></defs><circle cx="${n(x)}" cy="${n(y)}" r="${n(rad * halo)}" fill="url(#${id})"/><circle cx="${n(x)}" cy="${n(y)}" r="${n(rad)}" fill="${color}"/>`

/** A crescent moon: two arcs, with a soft halo. */
const crescent = (x: number, y: number, rad: number, color: string, glow: string, _sky: string, id: string) =>
  `<defs><radialGradient id="${id}"><stop offset="0" stop-color="${glow}" stop-opacity="0.5"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient></defs><circle cx="${n(x)}" cy="${n(y)}" r="${n(rad * 3.4)}" fill="url(#${id})"/>` +
  `<path d="M${n(x + rad * 0.2)} ${n(y - rad)}A${n(rad)} ${n(rad)} 0 1 0 ${n(x + rad * 0.2)} ${n(y + rad)}A${n(rad * 0.78)} ${n(rad)} 0 1 1 ${n(x + rad * 0.2)} ${n(y - rad)}Z" fill="${color}" transform="rotate(-24 ${n(x)} ${n(y)})"/>`

/** A ridge line: sums of sines with a little noise, filled down to the bottom. */
const ridge = (r: Rand, baseY: number, amp: number, color: string, opts: { step?: number; jag?: number; opacity?: number } = {}) => {
  const step = opts.step ?? 40
  const jag = opts.jag ?? 0.35
  const f1 = between(r, 0.0025, 0.005)
  const f2 = between(r, 0.008, 0.014)
  const p1 = r() * 10
  const p2 = r() * 10
  let d = `M0 ${H}`
  for (let x = 0; x <= W; x += step) {
    const y = baseY - amp * (0.55 * Math.sin(x * f1 + p1) + 0.3 * Math.sin(x * f2 + p2) + jag * (r() - 0.5))
    d += `L${x} ${n(y)}`
  }
  return `<path d="${d}L${W} ${H}Z" fill="${color}"${opts.opacity !== undefined ? ` opacity="${opts.opacity}"` : ''}/>`
}

/** A row of buildings with lit windows. */
const skyline = (r: Rand, baseY: number, minH: number, maxH: number, color: string, lit: string, opts: { minW?: number; maxW?: number; litShare?: number; spire?: number } = {}) => {
  const minW = opts.minW ?? 46
  const maxW = opts.maxW ?? 120
  let x = -20
  let s = ''
  let win = ''
  while (x < W + 20) {
    const w = between(r, minW, maxW)
    const h = between(r, minH, maxH)
    const top = baseY - h
    s += `<rect x="${n(x)}" y="${n(top)}" width="${n(w + 1)}" height="${n(h + 4)}" fill="${color}"/>`
    if (r() < (opts.spire ?? 0.18)) s += `<rect x="${n(x + w / 2 - 2)}" y="${n(top - between(r, 18, 60))}" width="4" height="60" fill="${color}"/>`
    if (r() < 0.3) s += `<rect x="${n(x + w * 0.2)}" y="${n(top - 12)}" width="${n(w * 0.45)}" height="14" fill="${color}"/>`
    // Windows on a grid, some lit.
    const cols = Math.max(2, Math.floor(w / 16))
    const rows = Math.max(2, Math.floor(h / 22))
    const cw = (w - 12) / cols
    for (let c = 0; c < cols; c++)
      for (let q = 0; q < rows; q++) {
        if (r() > (opts.litShare ?? 0.32)) continue
        win += `<rect x="${n(x + 6 + c * cw + 2)}" y="${n(top + 10 + q * 22)}" width="${n(Math.max(3, cw - 6))}" height="9" fill="${lit}" opacity="${n(between(r, 0.45, 1))}"/>`
      }
    x += w + between(r, -6, 10)
  }
  return s + win
}

/** Pine trees along a line. */
const pines = (r: Rand, baseY: number, count: number, minH: number, maxH: number, color: string) => {
  let s = ''
  for (let i = 0; i < count; i++) {
    const x = (i + r()) * (W / count)
    const h = between(r, minH, maxH)
    const w = h * between(r, 0.34, 0.46)
    const y = baseY + between(r, -8, 14)
    s += `<path d="M${n(x)} ${n(y - h)}L${n(x + w / 2)} ${n(y - h * 0.55)}L${n(x + w * 0.3)} ${n(y - h * 0.55)}L${n(x + w * 0.62)} ${n(y - h * 0.22)}L${n(x + w * 0.38)} ${n(y - h * 0.22)}L${n(x + w * 0.74)} ${n(y)}L${n(x - w * 0.74)} ${n(y)}L${n(x - w * 0.38)} ${n(y - h * 0.22)}L${n(x - w * 0.62)} ${n(y - h * 0.22)}L${n(x - w * 0.3)} ${n(y - h * 0.55)}L${n(x - w / 2)} ${n(y - h * 0.55)}Z" fill="${color}"/>`
  }
  return s
}

/** Soft cumulus built from overlapping discs with a flat base. */
const cloud = (r: Rand, x: number, y: number, scale: number, color: string, opacity: number) => {
  let s = `<g fill="${color}" opacity="${n(opacity)}">`
  const lumps = 5 + Math.floor(r() * 4)
  for (let i = 0; i < lumps; i++) {
    const t = i / (lumps - 1)
    const rad = scale * (0.5 + 0.5 * Math.sin(t * Math.PI)) * between(r, 0.75, 1.1)
    s += `<circle cx="${n(x + (t - 0.5) * scale * 3.2)}" cy="${n(y - rad * 0.55)}" r="${n(rad)}"/>`
  }
  return s + `<rect x="${n(x - scale * 1.9)}" y="${n(y - scale * 0.45)}" width="${n(scale * 3.8)}" height="${n(scale * 0.55)}" rx="${n(scale * 0.27)}"/></g>`
}
const clouds = (r: Rand, count: number, y0: number, y1: number, minS: number, maxS: number, color: string, opacity: number) => {
  let s = ''
  for (let i = 0; i < count; i++) s += cloud(r, r() * W, between(r, y0, y1), between(r, minS, maxS), color, opacity * between(r, 0.6, 1))
  return s
}

const rain = (r: Rand, count: number, color: string, slant = 0.22) => {
  let s = `<g stroke="${color}" stroke-linecap="round">`
  for (let i = 0; i < count; i++) {
    const x = r() * (W + 200) - 100
    const y = r() * H
    const len = between(r, 14, 46)
    s += `<line x1="${n(x)}" y1="${n(y)}" x2="${n(x - len * slant)}" y2="${n(y + len)}" stroke-width="${n(between(r, 0.8, 1.8))}" opacity="${n(between(r, 0.12, 0.5))}"/>`
  }
  return s + '</g>'
}

const snow = (r: Rand, count: number) => {
  let s = '<g fill="#fff">'
  for (let i = 0; i < count; i++) s += `<circle cx="${n(r() * W)}" cy="${n(r() * H)}" r="${n(between(r, 1, 3.4))}" opacity="${n(between(r, 0.3, 0.95))}"/>`
  return s + '</g>'
}

/** A band of haze, densest at `y`. */
const haze = (y: number, height: number, color: string, opacity: number, id: string) =>
  `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="0"/><stop offset="0.5" stop-color="${color}" stop-opacity="${opacity}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><rect x="0" y="${n(y - height / 2)}" width="${W}" height="${n(height)}" fill="url(#${id})"/>`

/** Glints on water: short horizontal strokes, denser near `cx`. */
const glints = (r: Rand, y0: number, y1: number, cx: number, spread: number, color: string, count: number) => {
  let s = `<g stroke="${color}" stroke-linecap="round">`
  for (let i = 0; i < count; i++) {
    const t = r()
    const y = y0 + (y1 - y0) * t
    const x = cx + (r() - 0.5) * spread * (0.3 + t * 1.6)
    const len = between(r, 10, 60) * (0.4 + t)
    s += `<line x1="${n(x - len / 2)}" y1="${n(y)}" x2="${n(x + len / 2)}" y2="${n(y)}" stroke-width="${n(1 + t * 2.2)}" opacity="${n(between(r, 0.2, 0.75))}"/>`
  }
  return s + '</g>'
}

/** The frame of a window looking out, with a sill. */
const windowFrame = (x: number, y: number, w: number, h: number, wall: string, frame: string, panes = 2) => {
  let s = `<path d="M0 0H${W}V${H}H0Z M${x} ${y}V${y + h}H${x + w}V${y}Z" fill="${wall}" fill-rule="evenodd"/>`
  s += `<rect x="${x - 10}" y="${y - 10}" width="${w + 20}" height="${h + 20}" fill="none" stroke="${frame}" stroke-width="20"/>`
  for (let i = 1; i < panes; i++) s += `<rect x="${n(x + (w / panes) * i - 6)}" y="${y}" width="12" height="${h}" fill="${frame}"/>`
  s += `<rect x="${x}" y="${n(y + h * 0.5 - 5)}" width="${w}" height="10" fill="${frame}"/>`
  s += `<rect x="${x - 40}" y="${y + h + 8}" width="${w + 80}" height="22" rx="4" fill="${frame}"/>`
  return s
}

const lampGlow = (x: number, y: number, rad: number, color: string, id: string, strength = 0.5) =>
  `<defs><radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${strength}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><circle cx="${n(x)}" cy="${n(y)}" r="${n(rad)}" fill="url(#${id})"/>`

/** A shelf of book spines. */
const books = (r: Rand, x: number, y: number, width: number, height: number, colors: readonly string[]) => {
  let s = ''
  let cx = x
  while (cx < x + width - 8) {
    const w = between(r, 9, 24)
    const h = height * between(r, 0.62, 1)
    const lean = r() < 0.08 ? between(r, -8, 8) : 0
    s += `<rect x="${n(cx)}" y="${n(y - h)}" width="${n(w)}" height="${n(h)}" rx="1.5" fill="${pick(r, colors)}"${lean ? ` transform="rotate(${n(lean)} ${n(cx)} ${n(y)})"` : ''}/>`
    if (r() < 0.5) s += `<rect x="${n(cx + 2)}" y="${n(y - h * 0.8)}" width="${n(Math.max(2, w - 4))}" height="3" fill="#fff" opacity="0.16"/>`
    cx += w + between(r, 0.5, 3)
  }
  return s
}

const plant = (x: number, y: number, s: number, pot: string, leaf: string) => {
  let out = `<path d="M${n(x - 20 * s)} ${n(y)}h${n(40 * s)}l${n(-6 * s)} ${n(34 * s)}h${n(-28 * s)}Z" fill="${pot}"/>`
  for (const [dx, dy, rot] of [[0, -46, 0], [-22, -34, -32], [22, -34, 32], [-34, -14, -62], [34, -14, 62]] as const)
    out += `<ellipse cx="${n(x + dx * s)}" cy="${n(y + dy * s)}" rx="${n(9 * s)}" ry="${n(26 * s)}" fill="${leaf}" transform="rotate(${rot} ${n(x + dx * s)} ${n(y + dy * s)})"/>`
  return out
}

// ── scenes ──────────────────────────────────────────────────────────────────

type Scene = (p: Palette, r: Rand) => string

const nightCity: Scene = (p, r) => {
  const mx = between(r, 220, 1380)
  return (
    sky(p) +
    stars(r, 150, 520) +
    (r() < 0.5 ? orb(mx, between(r, 120, 260), between(r, 38, 62), p.light, p.glow, 'o') : crescent(mx, between(r, 120, 240), 52, p.light, p.glow, p.sky[0], 'o')) +
    clouds(r, 5, 160, 420, 50, 110, p.far, 0.35) +
    skyline(r, 640, 90, 300, p.far, p.cool, { litShare: 0.16 }) +
    haze(640, 260, p.glow, 0.22, 'h1') +
    skyline(r, 760, 110, 380, p.mid, p.warm, { litShare: 0.3 }) +
    haze(790, 200, p.glow, 0.16, 'h2') +
    skyline(r, 920, 120, 320, p.near, p.warm, { litShare: 0.36, minW: 70, maxW: 170 })
  )
}

const rainyCity: Scene = (p, r) => {
  let bokeh = '<g filter="url(#blur)">'
  for (let i = 0; i < 46; i++) bokeh += `<circle cx="${n(r() * W)}" cy="${n(between(r, 300, 820))}" r="${n(between(r, 14, 46))}" fill="${pick(r, [p.warm, p.cool, p.light])}" opacity="${n(between(r, 0.18, 0.6))}"/>`
  bokeh += '</g>'
  let drops = ''
  for (let i = 0; i < 70; i++) {
    const x = r() * W
    const y = r() * H
    const rad = between(r, 2, 6)
    drops += `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rad)}" ry="${n(rad * 1.4)}" fill="#fff" opacity="${n(between(r, 0.1, 0.32))}"/>`
    if (r() < 0.35) drops += `<line x1="${n(x)}" y1="${n(y)}" x2="${n(x + between(r, -3, 3))}" y2="${n(y + between(r, 40, 160))}" stroke="#fff" stroke-width="${n(rad * 0.6)}" stroke-linecap="round" opacity="0.1"/>`
  }
  return (
    `<defs><filter id="blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="12"/></filter></defs>` +
    sky(p) +
    skyline(r, 720, 120, 420, p.far, p.cool, { litShare: 0.22 }) +
    skyline(r, 900, 100, 300, p.mid, p.warm, { litShare: 0.3, minW: 80, maxW: 180 }) +
    bokeh +
    rain(r, 260, '#fff', between(r, 0.1, 0.3)) +
    drops
  )
}

const cozyRoom: Scene = (p, r) => {
  const wx = between(r, 520, 700)
  const ww = 560
  const wy = 130
  const wh = 430
  // The view through the window.
  const view = `<g clip-path="url(#win)">${sky(p, 'vsky')}${stars(r, 60, 420)}${orb(wx + ww * between(r, 0.25, 0.75), wy + 110, 34, p.light, p.glow, 'vo')}${skyline(r, wy + wh + 20, 60, 230, p.far, p.warm, { litShare: 0.28 })}</g>`
  const deskY = 700
  const lampX = wx + ww + between(r, 120, 220)
  return (
    `<defs><clipPath id="win"><rect x="${n(wx)}" y="${wy}" width="${ww}" height="${wh}"/></clipPath></defs>` +
    view +
    windowFrame(Math.round(wx), wy, ww, wh, p.mid, p.near, 2) +
    // Shelf with books on the wall.
    `<rect x="110" y="330" width="330" height="12" rx="3" fill="${p.near}"/>` +
    books(r, 122, 330, 300, 110, [p.warm, p.cool, p.far, p.light, p.glow]) +
    plant(lampX + 150, 330, 0.9, p.near, p.cool) +
    // The desk and what is on it.
    `<rect x="0" y="${deskY}" width="${W}" height="${H - deskY}" fill="${p.near}"/><rect x="0" y="${deskY}" width="${W}" height="10" fill="#fff" opacity="0.06"/>` +
    lampGlow(lampX, deskY - 150, 380, p.warm, 'lg', 0.5) +
    `<path d="M${n(lampX - 70)} ${deskY - 150}L${n(lampX + 70)} ${deskY - 150}L${n(lampX + 44)} ${deskY - 220}L${n(lampX - 44)} ${deskY - 220}Z" fill="${p.warm}"/><rect x="${n(lampX - 5)}" y="${deskY - 150}" width="10" height="130" fill="${p.far}"/><rect x="${n(lampX - 44)}" y="${deskY - 22}" width="88" height="22" rx="8" fill="${p.far}"/>` +
    // An open book and a mug.
    `<path d="M${n(wx + 60)} ${deskY - 6}q90 -34 180 0q90 -34 180 0v26q-90 -30 -180 0q-90 -30 -180 0Z" fill="#f4ead6"/><path d="M${n(wx + 240)} ${deskY - 6}v26" stroke="${p.mid}" stroke-width="3"/>` +
    `<rect x="${n(wx - 150)}" y="${deskY - 66}" width="62" height="66" rx="8" fill="${p.cool}"/><path d="M${n(wx - 88)} ${deskY - 50}q34 0 34 20t-34 20" fill="none" stroke="${p.cool}" stroke-width="10"/>` +
    `<path d="M${n(wx - 132)} ${deskY - 80}q8 -18 0 -34m24 34q8 -18 0 -34" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0.3"/>`
  )
}

const mountains: Scene = (p, r) => {
  const sx = between(r, 300, 1300)
  return (
    sky(p) +
    stars(r, 70, 330) +
    orb(sx, between(r, 230, 360), between(r, 44, 70), p.light, p.glow, 'o', 6) +
    clouds(r, 4, 140, 330, 50, 90, '#fff', 0.2) +
    ridge(r, 520, 150, p.far, { jag: 0.5, opacity: 0.7 }) +
    haze(540, 220, p.glow, 0.25, 'h1') +
    ridge(r, 620, 170, p.far, { jag: 0.45 }) +
    haze(680, 200, p.sky[2], 0.3, 'h2') +
    ridge(r, 740, 150, p.mid, { jag: 0.3 }) +
    pines(r, 850, 26, 70, 150, p.near) +
    ridge(r, 900, 50, p.near, { jag: 0.1 })
  )
}

const forest: Scene = (p, r) => {
  let shafts = ''
  for (let i = 0; i < 5; i++) {
    const x = between(r, 200, 1400)
    shafts += `<path d="M${n(x)} 0L${n(x + 80)} 0L${n(x - 160)} ${H}L${n(x - 380)} ${H}Z" fill="${p.light}" opacity="${n(between(r, 0.04, 0.1))}"/>`
  }
  return (
    sky(p) +
    orb(between(r, 500, 1100), between(r, 160, 300), 60, p.light, p.glow, 'o', 6) +
    pines(r, 560, 30, 120, 260, p.far) +
    haze(560, 260, p.glow, 0.34, 'h1') +
    shafts +
    pines(r, 720, 22, 200, 380, p.mid) +
    haze(740, 240, p.sky[2], 0.3, 'h2') +
    ridge(r, 840, 40, p.near, { jag: 0.1 }) +
    `<rect y="850" width="${W}" height="50" fill="${p.near}"/>` +
    pines(r, 900, 14, 320, 560, p.near)
  )
}

const lake: Scene = (p, r) => {
  const hy = 520
  const mx = between(r, 400, 1200)
  const land = ridge(r, hy, 150, p.far, { jag: 0.4 }) + ridge(r, hy + 10, 90, p.mid, { jag: 0.25 }) + pines(r, hy + 6, 40, 30, 80, p.near)
  return (
    sky(p) +
    stars(r, 90, 320) +
    orb(mx, between(r, 180, 300), 46, p.light, p.glow, 'o', 6) +
    `<g clip-path="url(#above)">${land}</g>` +
    `<defs><clipPath id="above"><rect width="${W}" height="${hy}"/></clipPath><linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky[2]}"/><stop offset="1" stop-color="${p.sky[0]}"/></linearGradient></defs>` +
    `<rect y="${hy}" width="${W}" height="${H - hy}" fill="url(#water)"/>` +
    // The reflection: the land mirrored, dimmer.
    `<g transform="translate(0 ${2 * hy}) scale(1 -1)" opacity="0.38" clip-path="url(#above)">${land}</g>` +
    glints(r, hy + 14, H - 30, mx, 260, p.light, 70) +
    haze(hy, 70, p.glow, 0.5, 'h1')
  )
}

const retroSun: Scene = (p, r) => {
  const cx = W / 2
  const cy = 430
  const rad = between(r, 210, 260)
  let bars = ''
  for (let i = 0; i < 8; i++) {
    const y = cy + rad * (0.05 + i * 0.12)
    bars += `<rect x="${cx - rad - 4}" y="${n(y)}" width="${2 * rad + 8}" height="${n(5 + i * 3.2)}" fill="${p.sky[1]}"/>`
  }
  const hy = 610
  let grid = `<g stroke="${p.cool}" stroke-width="2" opacity="0.75">`
  for (let i = 0; i <= 12; i++) {
    const t = i / 12
    const y = hy + (H - hy) * t * t
    grid += `<line x1="0" y1="${n(y)}" x2="${W}" y2="${n(y)}" opacity="${n(0.35 + t * 0.65)}"/>`
  }
  for (let i = -14; i <= 14; i++) grid += `<line x1="${cx + i * 26}" y1="${hy}" x2="${cx + i * 220}" y2="${H}"/>`
  grid += '</g>'
  return (
    sky(p) +
    stars(r, 110, 420) +
    `<defs><linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.light}"/><stop offset="1" stop-color="${p.warm}"/></linearGradient></defs>` +
    lampGlow(cx, cy, rad * 2.2, p.warm, 'sg', 0.5) +
    `<circle cx="${cx}" cy="${cy}" r="${n(rad)}" fill="url(#sun)"/>` +
    bars +
    ridge(r, hy + 4, 120, p.far, { jag: 0.9, step: 60 }) +
    `<rect y="${hy}" width="${W}" height="${H - hy}" fill="${p.near}"/>` +
    grid +
    haze(hy, 60, p.cool, 0.5, 'h1')
  )
}

const lofiDesk: Scene = (p, r) => {
  const deskY = 660
  const mx = between(r, 560, 760)
  let code = ''
  for (let i = 0; i < 9; i++) code += `<rect x="${n(mx + 34 + (i % 3) * 14)}" y="${n(deskY - 300 + i * 24)}" width="${n(between(r, 90, 300))}" height="8" rx="4" fill="${pick(r, [p.cool, p.warm, p.light])}" opacity="0.8"/>`
  return (
    `<rect width="${W}" height="${H}" fill="${p.mid}"/>` +
    // A window on the left with the evening outside.
    `<g clip-path="url(#win)">${sky(p, 'vsky')}${stars(r, 40, 400)}${orb(230, 220, 30, p.light, p.glow, 'vo')}${skyline(r, 520, 60, 220, p.far, p.warm, { litShare: 0.3 })}</g><defs><clipPath id="win"><rect x="90" y="110" width="330" height="400"/></clipPath></defs>` +
    `<rect x="80" y="100" width="350" height="420" fill="none" stroke="${p.near}" stroke-width="18"/><rect x="250" y="110" width="10" height="400" fill="${p.near}"/>` +
    // Posters.
    `<rect x="1180" y="130" width="150" height="200" rx="6" fill="${p.far}"/><circle cx="1255" cy="210" r="44" fill="${p.warm}" opacity="0.85"/><rect x="1370" y="170" width="120" height="150" rx="6" fill="${p.cool}" opacity="0.7"/>` +
    // The desk, monitor, keyboard, mug, headphones.
    lampGlow(mx + 220, deskY - 200, 460, p.cool, 'sc', 0.32) +
    `<rect x="0" y="${deskY}" width="${W}" height="${H - deskY}" fill="${p.near}"/>` +
    `<rect x="${n(mx)}" y="${deskY - 330}" width="440" height="270" rx="14" fill="${p.sky[0]}" stroke="${p.far}" stroke-width="12"/>${code}<rect x="${n(mx + 200)}" y="${deskY - 60}" width="40" height="46" fill="${p.far}"/><rect x="${n(mx + 130)}" y="${deskY - 18}" width="180" height="18" rx="8" fill="${p.far}"/>` +
    `<rect x="${n(mx + 60)}" y="${deskY + 30}" width="320" height="26" rx="8" fill="${p.far}"/>` +
    `<rect x="${n(mx - 200)}" y="${deskY - 70}" width="60" height="70" rx="8" fill="${p.warm}"/><path d="M${n(mx - 140)} ${deskY - 52}q32 0 32 20t-32 20" fill="none" stroke="${p.warm}" stroke-width="10"/>` +
    `<path d="M${n(mx + 560)} ${deskY - 10}a56 56 0 0 1 112 0" fill="none" stroke="${p.far}" stroke-width="12"/><rect x="${n(mx + 546)}" y="${deskY - 30}" width="28" height="44" rx="12" fill="${p.cool}"/><rect x="${n(mx + 658)}" y="${deskY - 30}" width="28" height="44" rx="12" fill="${p.cool}"/>` +
    plant(1380, deskY - 34, 1.1, p.far, p.cool)
  )
}

const ocean: Scene = (p, r) => {
  const hy = between(r, 470, 540)
  const sx = between(r, 400, 1200)
  let waves = ''
  for (let i = 0; i < 9; i++) {
    const t = i / 8
    const y = hy + 20 + (H - hy) * t * t
    const amp = 4 + t * 16
    let d = `M0 ${n(y)}`
    for (let x = 0; x <= W; x += 80) d += `q20 ${n(-amp)} 40 0t40 0`
    waves += `<path d="${d}V${H}H0Z" fill="${i % 2 ? p.mid : p.far}" opacity="${n(0.35 + t * 0.4)}"/>`
  }
  return (
    sky(p) +
    orb(sx, hy - between(r, 30, 150), between(r, 54, 84), p.light, p.glow, 'o', 5) +
    clouds(r, 6, 120, hy - 120, 60, 130, '#fff', 0.5) +
    `<rect y="${n(hy)}" width="${W}" height="${n(H - hy)}" fill="${p.near}"/>` +
    waves +
    glints(r, hy + 8, H - 40, sx, 300, p.light, 80) +
    haze(hy, 60, p.glow, 0.5, 'h1')
  )
}

const desert: Scene = (p, r) => {
  const sx = between(r, 300, 1300)
  const dune = (baseY: number, amp: number, color: string) => {
    const ph = r() * 6
    let d = `M0 ${H}`
    for (let x = 0; x <= W; x += 40) d += `L${x} ${n(baseY - amp * (0.6 * Math.sin(x * 0.0032 + ph) + 0.4 * Math.sin(x * 0.0071 + ph * 2)))}`
    return `<path d="${d}L${W} ${H}Z" fill="${color}"/>`
  }
  const cactus = (x: number, y: number, s: number) =>
    `<g fill="${p.near}"><rect x="${n(x - 9 * s)}" y="${n(y - 120 * s)}" width="${n(18 * s)}" height="${n(120 * s)}" rx="${n(9 * s)}"/><path d="M${n(x - 9 * s)} ${n(y - 60 * s)}h${n(-26 * s)}v${n(-40 * s)}" fill="none" stroke="${p.near}" stroke-width="${n(14 * s)}" stroke-linecap="round" stroke-linejoin="round"/><path d="M${n(x + 9 * s)} ${n(y - 76 * s)}h${n(24 * s)}v${n(-30 * s)}" fill="none" stroke="${p.near}" stroke-width="${n(14 * s)}" stroke-linecap="round" stroke-linejoin="round"/></g>`
  return (
    sky(p) +
    stars(r, 50, 300) +
    orb(sx, between(r, 260, 400), between(r, 70, 110), p.light, p.glow, 'o', 4) +
    ridge(r, 560, 120, p.far, { jag: 0.7, opacity: 0.8 }) +
    dune(640, 60, p.far) +
    dune(730, 70, p.mid) +
    dune(840, 60, p.near) +
    cactus(between(r, 180, 520), 800, between(r, 0.9, 1.4)) +
    cactus(between(r, 1000, 1400), 830, between(r, 0.7, 1.1))
  )
}

const aurora: Scene = (p, r) => {
  let ribbons = '<g filter="url(#soft)">'
  for (let i = 0; i < 5; i++) {
    const y = between(r, 110, 330)
    const ph = r() * 6
    const depth = between(r, 70, 150)
    let top = `M-40 ${n(y)}`
    let bottom = ''
    for (let x = -40; x <= W + 40; x += 40) {
      const yy = y + 70 * Math.sin(x * 0.0035 + ph) + 34 * Math.sin(x * 0.012 + ph * 2)
      top += `L${x} ${n(yy)}`
      bottom = `L${x} ${n(yy + depth * (0.6 + 0.4 * Math.sin(x * 0.02 + ph)))}` + bottom
    }
    ribbons += `<path d="${top}${bottom}Z" fill="${i % 2 ? p.cool : p.glow}" opacity="${n(between(r, 0.2, 0.42))}"/>`
  }
  ribbons += '</g>'
  return (
    `<defs><filter id="soft" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="13"/></filter></defs>` +
    sky(p) +
    stars(r, 200, 600) +
    ribbons +
    ridge(r, 680, 120, p.far, { jag: 0.5 }) +
    ridge(r, 780, 90, p.mid, { jag: 0.2 }) +
    pines(r, 860, 18, 60, 150, p.near) +
    ridge(r, 900, 30, p.mid, { jag: 0.05 })
  )
}

const library: Scene = (p, r) => {
  const colors = [p.warm, p.cool, p.far, p.light, p.glow, '#7a4b2a', '#3e5a4f', '#6b3a4e']
  let shelves = ''
  for (let row = 0; row < 5; row++) {
    const y = 150 + row * 150
    shelves += `<rect x="0" y="${y}" width="560" height="14" fill="${p.near}"/><rect x="1040" y="${y}" width="560" height="14" fill="${p.near}"/>`
    shelves += books(r, 16, y, 530, 118, colors) + books(r, 1056, y, 530, 118, colors)
  }
  const ax = 600
  return (
    `<rect width="${W}" height="${H}" fill="${p.mid}"/>` +
    shelves +
    // An arched window between the shelves.
    `<defs><clipPath id="arch"><path d="M${ax} 760V330a200 200 0 0 1 400 0V760Z"/></clipPath></defs>` +
    `<g clip-path="url(#arch)">${sky(p, 'vsky')}${stars(r, 50, 500)}${orb(800, 300, 40, p.light, p.glow, 'vo', 5)}${ridge(r, 720, 90, p.far, { jag: 0.4 })}</g>` +
    `<path d="M${ax} 760V330a200 200 0 0 1 400 0V760" fill="none" stroke="${p.near}" stroke-width="22"/><rect x="${ax + 190}" y="140" width="20" height="620" fill="${p.near}"/><rect x="${ax}" y="470" width="400" height="16" fill="${p.near}"/>` +
    lampGlow(800, 300, 620, p.light, 'lg', 0.22) +
    // A reading table.
    `<rect x="420" y="770" width="760" height="26" rx="8" fill="${p.near}"/><rect x="480" y="796" width="24" height="104" fill="${p.near}"/><rect x="1096" y="796" width="24" height="104" fill="${p.near}"/>` +
    `<path d="M700 766q50 -22 100 0q50 -22 100 0v14q-50 -18 -100 0q-50 -18 -100 0Z" fill="#f4ead6"/>` +
    lampGlow(1020, 700, 220, p.warm, 'tl', 0.6) +
    `<path d="M990 700h60l-14 -44h-32Z" fill="${p.warm}"/><rect x="1016" y="700" width="8" height="66" fill="${p.far}"/>`
  )
}

const trainWindow: Scene = (p, r) => {
  const wx = 150
  const wy = 150
  const ww = 1300
  const wh = 520
  let poles = ''
  for (let i = 0; i < 5; i++) {
    const x = wx + 120 + i * 260 + between(r, -30, 30)
    poles += `<rect x="${n(x)}" y="${wy + 60}" width="10" height="${wh}" fill="${p.near}" opacity="0.85"/><rect x="${n(x - 40)}" y="${wy + 100}" width="90" height="6" fill="${p.near}" opacity="0.85"/>`
  }
  return (
    `<defs><clipPath id="win"><rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" rx="46"/></clipPath></defs>` +
    `<rect width="${W}" height="${H}" fill="${p.near}"/>` +
    `<g clip-path="url(#win)">${sky(p, 'vsky')}${stars(r, 60, 380)}${orb(between(r, 400, 1200), wy + 150, 46, p.light, p.glow, 'vo', 5)}${clouds(r, 4, wy + 60, wy + 220, 50, 90, '#fff', 0.25)}${ridge(r, 520, 110, p.far, { jag: 0.4 })}${ridge(r, 600, 80, p.mid, { jag: 0.25 })}${pines(r, 680, 26, 40, 110, p.near)}<path d="M${wx} ${wy + 130}Q${wx + ww / 2} ${wy + 190} ${wx + ww} ${wy + 120}" fill="none" stroke="${p.near}" stroke-width="3" opacity="0.8"/>${poles}</g>` +
    `<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" rx="46" fill="none" stroke="${p.mid}" stroke-width="26"/>` +
    // The table under the window, with a cup.
    `<rect x="${wx + 60}" y="${wy + wh + 60}" width="${ww - 120}" height="26" rx="10" fill="${p.mid}"/>` +
    `<rect x="${wx + 220}" y="${wy + wh - 6}" width="54" height="66" rx="8" fill="${p.warm}"/><path d="M${wx + 232} ${wy + wh - 20}q8 -18 0 -34m22 34q8 -18 0 -34" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0.3"/>` +
    lampGlow(W / 2, 60, 520, p.warm, 'cab', 0.2)
  )
}

const sakura: Scene = (p, r) => {
  const blossom = (x: number, y: number, s: number, o: number) => {
    let b = `<g opacity="${n(o)}">`
    for (let i = 0; i < 5; i++) b += `<ellipse cx="${n(x)}" cy="${n(y - 9 * s)}" rx="${n(6 * s)}" ry="${n(10 * s)}" fill="${p.light}" transform="rotate(${i * 72} ${n(x)} ${n(y)})"/>`
    return b + `<circle cx="${n(x)}" cy="${n(y)}" r="${n(3.4 * s)}" fill="${p.warm}"/></g>`
  }
  const branch = (x0: number, y0: number, len: number, angle: number, width: number, depth: number): string => {
    const x1 = x0 + Math.cos(angle) * len
    const y1 = y0 + Math.sin(angle) * len
    let s = `<path d="M${n(x0)} ${n(y0)}Q${n((x0 + x1) / 2 + between(r, -30, 30))} ${n((y0 + y1) / 2 + between(r, -30, 30))} ${n(x1)} ${n(y1)}" fill="none" stroke="${p.near}" stroke-width="${n(width)}" stroke-linecap="round"/>`
    if (depth > 0) {
      s += branch(x1, y1, len * between(r, 0.6, 0.78), angle + between(r, 0.25, 0.6), width * 0.62, depth - 1)
      s += branch(x1, y1, len * between(r, 0.55, 0.72), angle - between(r, 0.25, 0.6), width * 0.6, depth - 1)
    }
    const count = depth === 0 ? 5 : 2
    for (let i = 0; i < count; i++) s += blossom(x1 + between(r, -46, 46), y1 + between(r, -40, 40), between(r, 1.1, 2), between(r, 0.75, 1))
    return s
  }
  let petals = ''
  for (let i = 0; i < 60; i++) {
    const x = n(r() * W)
    const y = n(r() * H)
    petals += `<ellipse cx="${x}" cy="${y}" rx="${n(between(r, 4, 8))}" ry="${n(between(r, 2, 4))}" fill="${p.light}" opacity="${n(between(r, 0.4, 0.9))}" transform="rotate(${n(r() * 180)} ${x} ${y})"/>`
  }
  return (
    sky(p) +
    orb(between(r, 900, 1300), between(r, 200, 320), 60, '#fff', p.glow, 'o', 5) +
    clouds(r, 4, 180, 420, 60, 120, '#fff', 0.35) +
    ridge(r, 760, 110, p.far, { jag: 0.3, opacity: 0.7 }) +
    ridge(r, 860, 80, p.mid, { jag: 0.2 }) +
    branch(-20, between(r, 160, 300), 300, between(r, -0.1, 0.25), 26, 3) +
    branch(W + 20, between(r, 60, 180), 260, Math.PI + between(r, -0.3, 0.1), 20, 3) +
    petals
  )
}

const snowCabin: Scene = (p, r) => {
  const cx = between(r, 520, 1080)
  const cy = 700
  return (
    sky(p) +
    stars(r, 110, 420) +
    crescent(between(r, 200, 1400), between(r, 120, 220), 44, p.light, p.glow, p.sky[0], 'o') +
    ridge(r, 600, 150, p.far, { jag: 0.5 }) +
    pines(r, 700, 22, 90, 200, p.mid) +
    ridge(r, 740, 50, '#e9eef6', { jag: 0.08 }) +
    // The cabin.
    lampGlow(cx, cy - 40, 320, p.warm, 'cg', 0.55) +
    `<rect x="${n(cx - 130)}" y="${cy - 110}" width="260" height="130" fill="${p.near}"/><path d="M${n(cx - 160)} ${cy - 104}L${n(cx)} ${cy - 220}L${n(cx + 160)} ${cy - 104}Z" fill="${p.mid}"/><path d="M${n(cx - 166)} ${cy - 100}L${n(cx)} ${cy - 228}L${n(cx + 166)} ${cy - 100}" fill="none" stroke="#f3f6fb" stroke-width="16" stroke-linejoin="round"/>` +
    `<rect x="${n(cx - 90)}" y="${cy - 80}" width="60" height="56" rx="4" fill="${p.warm}"/><path d="M${n(cx - 60)} ${cy - 80}v56M${n(cx - 90)} ${cy - 52}h60" stroke="${p.near}" stroke-width="5"/><rect x="${n(cx + 30)}" y="${cy - 84}" width="50" height="104" rx="4" fill="${p.mid}"/><rect x="${n(cx + 60)}" y="${cy - 250}" width="34" height="80" fill="${p.near}"/>` +
    `<path d="M${n(cx + 77)} ${cy - 260}q-22 -30 0 -56t0 -56" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round" opacity="0.14"/>` +
    pines(r, 860, 9, 220, 420, p.near) +
    ridge(r, 880, 40, '#f3f6fb', { jag: 0.05 }) +
    snow(r, 220)
  )
}

const cloudscape: Scene = (p, r) =>
  sky(p) +
  orb(between(r, 300, 1300), between(r, 200, 420), between(r, 50, 80), p.light, p.glow, 'o', 6) +
  clouds(r, 5, 260, 420, 60, 110, p.far, 0.55) +
  clouds(r, 6, 420, 600, 100, 180, p.mid, 0.8) +
  clouds(r, 6, 640, 820, 150, 260, p.near, 0.95) +
  clouds(r, 5, 860, 980, 220, 320, p.light, 0.8)

const space: Scene = (p, r) => {
  const px = between(r, 300, 1300)
  const py = between(r, 480, 700)
  const pr = between(r, 180, 300)
  let nebula = '<g filter="url(#neb)">'
  for (let i = 0; i < 7; i++) nebula += `<ellipse cx="${n(r() * W)}" cy="${n(r() * H * 0.8)}" rx="${n(between(r, 160, 380))}" ry="${n(between(r, 80, 200))}" fill="${pick(r, [p.cool, p.warm, p.glow])}" opacity="${n(between(r, 0.1, 0.24))}"/>`
  nebula += '</g>'
  return (
    `<defs><filter id="neb" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="50"/></filter><linearGradient id="pl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.light}"/><stop offset="1" stop-color="${p.near}"/></linearGradient><clipPath id="pc"><circle cx="${n(px)}" cy="${n(py)}" r="${n(pr)}"/></clipPath></defs>` +
    sky(p) +
    nebula +
    stars(r, 320, H) +
    lampGlow(px, py, pr * 1.5, p.glow, 'pg', 0.35) +
    `<circle cx="${n(px)}" cy="${n(py)}" r="${n(pr)}" fill="url(#pl)"/>` +
    `<g clip-path="url(#pc)" opacity="0.28">${[0.2, 0.42, 0.63, 0.8].map((t) => `<rect x="${n(px - pr)}" y="${n(py - pr + 2 * pr * t)}" width="${n(2 * pr)}" height="${n(pr * between(r, 0.06, 0.16))}" fill="${p.sky[0]}"/>`).join('')}</g>` +
    `<ellipse cx="${n(px)}" cy="${n(py)}" rx="${n(pr * 1.7)}" ry="${n(pr * 0.32)}" fill="none" stroke="${p.warm}" stroke-width="10" opacity="0.5" transform="rotate(-16 ${n(px)} ${n(py)})"/>` +
    orb(between(r, 150, 1450), between(r, 100, 300), between(r, 20, 44), p.cool, p.cool, 'm2', 3)
  )
}

const rooftop: Scene = (p, r) => {
  const ry = 700
  let wires = ''
  for (let i = 0; i < 3; i++) wires += `<path d="M-20 ${n(between(r, 260, 420))}Q${W / 2} ${n(between(r, 420, 560))} ${W + 20} ${n(between(r, 240, 400))}" fill="none" stroke="${p.near}" stroke-width="3"/>`
  const tankX = between(r, 180, 420)
  const antX = between(r, 1100, 1400)
  return (
    sky(p) +
    stars(r, 60, 300) +
    orb(between(r, 500, 1100), between(r, 330, 470), between(r, 60, 96), p.light, p.glow, 'o', 5) +
    clouds(r, 5, 160, 400, 60, 130, p.warm, 0.35) +
    skyline(r, 640, 60, 220, p.far, p.warm, { litShare: 0.2 }) +
    haze(640, 180, p.glow, 0.3, 'h1') +
    wires +
    `<rect y="${ry}" width="${W}" height="${H - ry}" fill="${p.near}"/><rect y="${ry - 26}" width="${W}" height="26" fill="${p.mid}"/>` +
    // A water tank, an antenna, a vent.
    `<rect x="${n(tankX)}" y="${ry - 200}" width="150" height="120" rx="10" fill="${p.mid}"/><path d="M${n(tankX - 8)} ${ry - 200}L${n(tankX + 75)} ${ry - 244}L${n(tankX + 158)} ${ry - 200}Z" fill="${p.near}"/><path d="M${n(tankX + 20)} ${ry - 80}v54M${n(tankX + 130)} ${ry - 80}v54" stroke="${p.near}" stroke-width="10"/>` +
    `<path d="M${n(antX)} ${ry - 26}v-260M${n(antX - 60)} ${ry - 250}h120M${n(antX - 44)} ${ry - 210}h88M${n(antX - 30)} ${ry - 170}h60" stroke="${p.near}" stroke-width="7" stroke-linecap="round"/>` +
    `<rect x="${n(antX - 320)}" y="${ry - 90}" width="120" height="64" rx="6" fill="${p.mid}"/>` +
    // Someone's chair and a lantern.
    lampGlow(820, ry - 60, 180, p.warm, 'ln', 0.6) +
    `<rect x="808" y="${ry - 70}" width="24" height="34" rx="6" fill="${p.warm}"/><path d="M700 ${ry - 26}v-70h70v70M700 ${ry - 60}h70" fill="none" stroke="${p.mid}" stroke-width="9" stroke-linejoin="round"/>`
  )
}

const lighthouse: Scene = (p, r) => {
  const hy = 600
  const lx = between(r, 980, 1280)
  const side = r() < 0.5 ? -1 : 1
  return (
    sky(p) +
    stars(r, 130, 440) +
    crescent(between(r, 180, 700), between(r, 110, 220), 40, p.light, p.glow, p.sky[0], 'o') +
    clouds(r, 4, 160, 380, 60, 120, p.far, 0.4) +
    // The beam.
    `<path d="M${n(lx)} ${hy - 330}L${n(lx + side * 1500)} ${hy - 560}L${n(lx + side * 1500)} ${hy - 250}Z" fill="${p.warm}" opacity="0.16"/>` +
    `<rect y="${hy}" width="${W}" height="${H - hy}" fill="${p.mid}"/>` +
    glints(r, hy + 10, H - 30, lx, 500, p.warm, 60) +
    // The headland and the tower.
    `<path d="M${n(lx - 420)} ${H}Q${n(lx - 260)} ${hy - 40} ${n(lx - 60)} ${hy - 60}H${n(lx + 120)}Q${n(lx + 320)} ${hy - 20} ${W + 40} ${hy + 40}V${H}Z" fill="${p.near}"/>` +
    `<path d="M${n(lx - 30)} ${hy - 60}L${n(lx - 18)} ${hy - 300}h36L${n(lx + 30)} ${hy - 60}Z" fill="#eef1f6"/><rect x="${n(lx - 22)}" y="${hy - 230}" width="44" height="34" fill="${p.cool}"/><rect x="${n(lx - 26)}" y="${hy - 140}" width="52" height="34" fill="${p.cool}"/>` +
    `<rect x="${n(lx - 26)}" y="${hy - 340}" width="52" height="40" rx="4" fill="${p.warm}"/><path d="M${n(lx - 34)} ${hy - 340}L${n(lx)} ${hy - 380}L${n(lx + 34)} ${hy - 340}Z" fill="${p.near}"/>` +
    lampGlow(lx, hy - 320, 150, p.warm, 'lh', 0.8) +
    haze(hy, 50, p.glow, 0.4, 'h1')
  )
}

const studyNook: Scene = (p, r) => {
  const colors = [p.warm, p.cool, p.far, p.light, '#7a4b2a', '#3e5a4f', '#6b3a4e', p.glow]
  let shelves = ''
  for (let row = 0; row < 4; row++) {
    const y = 190 + row * 150
    shelves += `<rect x="60" y="${y}" width="620" height="14" fill="${p.near}"/>` + books(r, 76, y, 590, 116, colors)
  }
  const lx = 1010
  return (
    `<rect width="${W}" height="${H}" fill="${p.mid}"/>` +
    `<rect x="46" y="60" width="648" height="660" rx="10" fill="${p.far}" opacity="0.5"/>` +
    shelves +
    // A round window with the night outside.
    `<defs><clipPath id="rw"><circle cx="1330" cy="280" r="150"/></clipPath></defs><g clip-path="url(#rw)">${sky(p, 'vsky')}${stars(r, 40, 430)}${orb(1380, 240, 30, p.light, p.glow, 'vo', 5)}</g><circle cx="1330" cy="280" r="150" fill="none" stroke="${p.near}" stroke-width="18"/><path d="M1330 130v300M1180 280h300" stroke="${p.near}" stroke-width="10"/>` +
    // Floor, rug, armchair, lamp.
    `<rect y="740" width="${W}" height="160" fill="${p.near}"/><ellipse cx="1000" cy="820" rx="460" ry="50" fill="${p.cool}" opacity="0.35"/>` +
    lampGlow(lx, 420, 420, p.warm, 'fl', 0.5) +
    `<rect x="${lx - 5}" y="440" width="10" height="320" fill="${p.far}"/><path d="M${lx - 80} 440h160l-40 -90h-80Z" fill="${p.warm}"/><rect x="${lx - 50}" y="752" width="100" height="14" rx="7" fill="${p.far}"/>` +
    `<path d="M1120 560q0 -70 70 -70h140q70 0 70 70v130h60v90h-400v-90h60Z" fill="${p.cool}"/><rect x="1150" y="660" width="220" height="60" rx="18" fill="${p.light}" opacity="0.35"/><rect x="1090" y="776" width="24" height="30" fill="${p.far}"/><rect x="1466" y="776" width="24" height="30" fill="${p.far}"/>` +
    plant(820, 706, 1.2, p.far, p.cool)
  )
}

const riverValley: Scene = (p, r) => {
  const sx = between(r, 500, 1100)
  return (
    sky(p) +
    orb(sx, between(r, 250, 360), between(r, 50, 76), p.light, p.glow, 'o', 6) +
    clouds(r, 4, 120, 300, 60, 110, '#fff', 0.3) +
    ridge(r, 560, 190, p.far, { jag: 0.4, opacity: 0.75 }) +
    haze(560, 200, p.glow, 0.3, 'h1') +
    `<path d="M0 ${H}V640Q400 520 760 620T${W} 600V${H}Z" fill="${p.mid}"/>` +
    // The river winding to the foreground.
    `<path d="M${n(sx - 20)} 600Q${n(sx + 140)} 660 ${n(sx - 60)} 720T${n(sx + 80)} 820T${n(sx - 240)} ${H}H${n(sx + 420)}Q${n(sx + 260)} 800 ${n(sx + 150)} 760T${n(sx + 120)} 660Q${n(sx + 60)} 620 ${n(sx + 20)} 600Z" fill="${p.sky[1]}" opacity="0.9"/>` +
    glints(r, 640, H - 20, sx + 60, 160, p.light, 40) +
    pines(r, 700, 16, 60, 130, p.near) +
    `<path d="M0 ${H}V800Q300 740 620 830T${W} 800V${H}Z" fill="${p.near}" opacity="0.92"/>` +
    pines(r, 880, 8, 180, 320, p.near)
  )
}

const harbor: Scene = (p, r) => {
  const hy = 560
  let boats = ''
  for (let i = 0; i < 4; i++) {
    const x = between(r, 120, 1480)
    const y = hy + between(r, 60, 260)
    const s = 0.6 + (y - hy) / 260
    boats += `<g transform="translate(${n(x)} ${n(y)}) scale(${n(s)})"><path d="M-60 0h120l-18 26h-84Z" fill="${p.near}"/><path d="M0 0v-110" stroke="${p.near}" stroke-width="5"/><path d="M4 -106L54 -14H4Z" fill="#eef1f6" opacity="0.9"/><path d="M-4 -90L-40 -14H-4Z" fill="${p.warm}" opacity="0.9"/></g>`
  }
  return (
    sky(p) +
    orb(between(r, 300, 1300), hy - between(r, 40, 160), between(r, 60, 90), p.light, p.glow, 'o', 5) +
    clouds(r, 5, 120, 380, 60, 120, p.warm, 0.4) +
    skyline(r, hy, 40, 150, p.far, p.warm, { litShare: 0.3, minW: 40, maxW: 90, spire: 0.3 }) +
    `<rect y="${hy}" width="${W}" height="${H - hy}" fill="${p.mid}"/>` +
    glints(r, hy + 8, H - 30, W / 2, 1200, p.light, 110) +
    boats +
    `<rect x="0" y="840" width="${W}" height="60" fill="${p.near}"/><path d="M120 840v-40M420 840v-40M720 840v-40M1020 840v-40M1320 840v-40" stroke="${p.near}" stroke-width="16"/>` +
    haze(hy, 60, p.glow, 0.45, 'h1')
  )
}

// ── palettes ────────────────────────────────────────────────────────────────

const P = (sky: [string, string, string], light: string, glow: string, far: string, mid: string, near: string, warm: string, cool: string): Palette => ({ sky, light, glow, far, mid, near, warm, cool })

const NIGHT: Record<string, Palette> = {
  Indigo: P(['#0b1030', '#1b2256', '#3a2f6b'], '#fdf3d0', '#b9c4ff', '#232a5c', '#171c44', '#0c1029', '#ffd27a', '#7fd0ff'),
  Midnight: P(['#050a1c', '#0d1a3a', '#1b2d55'], '#eef3ff', '#8fb3ff', '#16264a', '#0e1833', '#070d1f', '#ffcf70', '#6fe0d8'),
  Violet: P(['#170b2e', '#3a1859', '#7a2d6f'], '#ffe3f0', '#ff9fd2', '#3d1b5c', '#28103f', '#150826', '#ffc46b', '#ff7ac8'),
  Teal: P(['#04161d', '#0b3540', '#17606a'], '#eafff6', '#8fe9d6', '#0f3d47', '#0a2a33', '#05171d', '#ffd98a', '#7df0e0'),
  Ember: P(['#1a0b14', '#4a1a2a', '#a5432f'], '#ffe7b8', '#ff9a5a', '#4a1f2c', '#30131e', '#170911', '#ffc266', '#ff8f6b'),
  Plum: P(['#120a24', '#2a1747', '#54306e'], '#f6e9ff', '#c9a2ff', '#2f1c4e', '#1e1236', '#0f0920', '#ffd08a', '#a9b6ff'),
  Slate: P(['#0c1118', '#1b2633', '#324354'], '#f1f5fa', '#a9c0d8', '#22303f', '#17212c', '#0b1118', '#ffd9a0', '#9fd4ff'),
  Rose: P(['#1d0d1c', '#4b1e3c', '#93486a'], '#ffeef2', '#ffa8c0', '#4d2140', '#33152b', '#190a16', '#ffcf8f', '#ffa0c8'),
  Neon: P(['#07041a', '#1b0b4a', '#4b1289'], '#f3e8ff', '#c06bff', '#1e0f52', '#140a38', '#090420', '#ff5fa2', '#3fe8ff'),
  Moss: P(['#08130f', '#16302a', '#2f5547'], '#f1fbe9', '#b7e3b0', '#1c3a30', '#122720', '#081410', '#ffd58a', '#9ce6c0'),
  Cobalt: P(['#040b24', '#0c2460', '#1d4a9a'], '#f0f6ff', '#86b6ff', '#12306e', '#0b1f4c', '#050f27', '#ffd47a', '#7fe3ff'),
  Copper: P(['#140c0a', '#3a2118', '#7a4a2c'], '#ffeccf', '#ffb876', '#3f261c', '#281711', '#130b08', '#ffc978', '#ff9d7a'),
}

const DUSK: Record<string, Palette> = {
  Peach: P(['#2b2a5a', '#b05a7a', '#ffb07a'], '#fff1c9', '#ffd08a', '#6f4a78', '#44345f', '#231d3f', '#ffd27a', '#ffa0b8'),
  Lavender: P(['#2a2f6b', '#7d6fb8', '#f0b3c8'], '#fff6e0', '#ffd6e6', '#5a5796', '#3b3a72', '#1f2148', '#ffe19a', '#b8c8ff'),
  Amber: P(['#3a2247', '#c2603f', '#ffc46a'], '#fff5cf', '#ffdc8f', '#7a4046', '#4c2a3a', '#271626', '#ffe08f', '#ff9a78'),
  Coral: P(['#1f2b5c', '#a84f77', '#ff8f72'], '#fff0d4', '#ffc19a', '#5f3f73', '#3c2c58', '#1e1838', '#ffd38a', '#ff9db0'),
  Mint: P(['#16324a', '#3f8f8a', '#c9f0c8'], '#fbfff0', '#e0ffd8', '#2f6a72', '#1f4a58', '#10283a', '#fff0a0', '#9ff0e0'),
  Gold: P(['#31264f', '#a5673f', '#ffd98a'], '#fff8dc', '#ffe6a8', '#6d4a52', '#453048', '#221a30', '#ffe7a0', '#ffb890'),
  Mauve: P(['#252252', '#86588f', '#f2a6b2'], '#fff0ec', '#ffcfd8', '#5a4578', '#3a2e5c', '#1c1838', '#ffd8a0', '#d2b6ff'),
  Storm: P(['#1c2433', '#4a5a70', '#9fb0c2'], '#f2f6fa', '#d5e0ea', '#3c4a5e', '#293444', '#141b26', '#ffd9a0', '#a8d0f0'),
}

const DAY: Record<string, Palette> = {
  Azure: P(['#3f7fd0', '#8fc3f2', '#e6f3ff'], '#fffbe6', '#fff2c0', '#6f9fd0', '#4f7fb5', '#2f5a8c', '#ffe08a', '#bfe6ff'),
  Spring: P(['#5aa9d6', '#a8dcf0', '#f6f0e0'], '#fffdf0', '#fff4cc', '#7fb39a', '#5a917a', '#356a58', '#ffd98a', '#c8f0e0'),
  Blossom: P(['#7fa8e0', '#f2c6dc', '#fff0f0'], '#ffe3ee', '#ffd0e0', '#b08fb5', '#8a6d98', '#5a4670', '#ff9fb8', '#d8c8ff'),
  Haze: P(['#6f8fb5', '#c0cfe0', '#f2ede0'], '#fffaf0', '#fff0d8', '#8fa0b5', '#6c7f98', '#48586f', '#ffd8a0', '#d0e4f5'),
}

// ── the catalogue ───────────────────────────────────────────────────────────

export type WallpaperCategory = 'Night city' | 'Rain' | 'Cozy room' | 'Study' | 'Lo-fi' | 'Retro' | 'Nature' | 'Sky'

interface Family {
  key: string
  /** What the wallpaper is called, before its palette's name. */
  name: string
  category: WallpaperCategory
  scene: Scene
  palettes: Record<string, Palette>
  /** Only these palettes (default: all in the set). */
  only?: string[]
  /** Variants per palette (different seeds). */
  variants: number
}

const FAMILIES: Family[] = [
  { key: 'city', name: 'City lights', category: 'Night city', scene: nightCity, palettes: NIGHT, variants: 2 },
  { key: 'rooftop', name: 'Rooftop', category: 'Night city', scene: rooftop, palettes: { ...DUSK, Indigo: NIGHT.Indigo, Ember: NIGHT.Ember }, variants: 1 },
  { key: 'harbor', name: 'Harbour', category: 'Night city', scene: harbor, palettes: DUSK, variants: 1 },
  { key: 'rain', name: 'Rain on the glass', category: 'Rain', scene: rainyCity, palettes: NIGHT, variants: 2 },
  { key: 'cozy', name: 'Desk by the window', category: 'Cozy room', scene: cozyRoom, palettes: NIGHT, variants: 1 },
  { key: 'cabin', name: 'Cabin in the snow', category: 'Cozy room', scene: snowCabin, palettes: NIGHT, only: ['Indigo', 'Midnight', 'Slate', 'Cobalt', 'Plum', 'Teal'], variants: 2 },
  { key: 'train', name: 'Window seat', category: 'Cozy room', scene: trainWindow, palettes: { ...DUSK, Midnight: NIGHT.Midnight, Indigo: NIGHT.Indigo }, variants: 1 },
  { key: 'library', name: 'Library', category: 'Study', scene: library, palettes: NIGHT, only: ['Copper', 'Ember', 'Slate', 'Plum', 'Moss', 'Indigo', 'Midnight', 'Teal'], variants: 1 },
  { key: 'nook', name: 'Reading nook', category: 'Study', scene: studyNook, palettes: NIGHT, only: ['Copper', 'Ember', 'Slate', 'Plum', 'Moss', 'Indigo', 'Rose', 'Teal'], variants: 1 },
  { key: 'lofi', name: 'Late desk', category: 'Lo-fi', scene: lofiDesk, palettes: NIGHT, variants: 1 },
  { key: 'retro', name: 'Retro sun', category: 'Retro', scene: retroSun, palettes: NIGHT, only: ['Neon', 'Violet', 'Ember', 'Rose', 'Cobalt', 'Plum', 'Indigo', 'Teal'], variants: 2 },
  { key: 'space', name: 'Far planet', category: 'Retro', scene: space, palettes: NIGHT, only: ['Neon', 'Violet', 'Cobalt', 'Plum', 'Teal', 'Midnight', 'Rose', 'Indigo'], variants: 1 },
  { key: 'mountain', name: 'Ridges', category: 'Nature', scene: mountains, palettes: { ...DUSK, ...NIGHT }, variants: 1 },
  { key: 'forest', name: 'Pinewood', category: 'Nature', scene: forest, palettes: { ...DUSK, Moss: NIGHT.Moss, Teal: NIGHT.Teal, Midnight: NIGHT.Midnight, Slate: NIGHT.Slate }, variants: 1 },
  { key: 'lake', name: 'Still lake', category: 'Nature', scene: lake, palettes: { ...DUSK, Indigo: NIGHT.Indigo, Midnight: NIGHT.Midnight, Teal: NIGHT.Teal, Cobalt: NIGHT.Cobalt }, variants: 1 },
  { key: 'valley', name: 'River valley', category: 'Nature', scene: riverValley, palettes: { ...DUSK, ...DAY }, variants: 1 },
  { key: 'ocean', name: 'Open sea', category: 'Nature', scene: ocean, palettes: { ...DUSK, ...DAY }, variants: 1 },
  { key: 'desert', name: 'Dunes', category: 'Nature', scene: desert, palettes: { ...DUSK, Ember: NIGHT.Ember, Copper: NIGHT.Copper }, variants: 1 },
  { key: 'sakura', name: 'Blossom', category: 'Nature', scene: sakura, palettes: { ...DAY, Lavender: DUSK.Lavender, Mauve: DUSK.Mauve, Peach: DUSK.Peach, Coral: DUSK.Coral }, variants: 1 },
  { key: 'lighthouse', name: 'Lighthouse', category: 'Nature', scene: lighthouse, palettes: NIGHT, only: ['Indigo', 'Midnight', 'Slate', 'Cobalt', 'Teal', 'Plum'], variants: 1 },
  { key: 'aurora', name: 'Aurora', category: 'Sky', scene: aurora, palettes: NIGHT, only: ['Teal', 'Moss', 'Midnight', 'Cobalt', 'Violet', 'Neon', 'Plum', 'Indigo'], variants: 1 },
  { key: 'clouds', name: 'Above the clouds', category: 'Sky', scene: cloudscape, palettes: { ...DUSK, ...DAY }, variants: 1 },
]

export interface Wallpaper {
  id: string
  name: string
  category: WallpaperCategory
  /** Light scenes get a stronger scrim under the clock. */
  bright: boolean
}

interface Entry extends Wallpaper {
  family: Family
  palette: Palette
  seed: number
}

const ENTRIES: Entry[] = FAMILIES.flatMap((f) =>
  Object.entries(f.palettes)
    .filter(([name]) => !f.only || f.only.includes(name))
    .flatMap(([name, palette]) =>
      Array.from({ length: f.variants }, (_, v) => {
        const id = `${f.key}-${name.toLowerCase()}${v ? `-${v + 1}` : ''}`
        return { id, name: `${f.name} · ${name}${v ? ` ${v + 1}` : ''}`, category: f.category, bright: name in DAY, family: f, palette, seed: hash(id) }
      }),
    ),
)

/** Every wallpaper, grouped by family in catalogue order. */
export const WALLPAPERS: Wallpaper[] = ENTRIES.map(({ id, name, category, bright }) => ({ id, name, category, bright }))
export const WALLPAPER_CATEGORIES: WallpaperCategory[] = ['Night city', 'Rain', 'Cozy room', 'Study', 'Lo-fi', 'Retro', 'Nature', 'Sky']

const byId = new Map(ENTRIES.map((e) => [e.id, e]))

/** The SVG document for a wallpaper (1600 × 900, scales to any size). Unknown ids fall back to the first. */
export function renderWallpaper(id: string): string {
  const e = byId.get(id) ?? ENTRIES[0]
  const body = e.family.scene(e.palette, rng(e.seed))
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice">${body}</svg>`
}

/** A wallpaper as an image URL (a data URI, so it can be a CSS background or an <img> source). */
export function wallpaperUrl(id: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderWallpaper(id))}`
}
