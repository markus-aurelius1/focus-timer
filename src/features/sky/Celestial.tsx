/**
 * Hand-drawn (in code) celestial objects unlocked by milestones. Each appears
 * in your sky once earned – quiet, low-contrast decoration that makes the sky
 * feel more yours over time.
 */
import type { CelestialId } from '@/game/progression'

const Glow = ({ id, color, r = 1 }: { id: string; color: string; r?: number }) => (
  <radialGradient id={id}>
    <stop offset="0%" stopColor={color} stopOpacity={0.9 * r} />
    <stop offset="40%" stopColor={color} stopOpacity={0.25 * r} />
    <stop offset="100%" stopColor={color} stopOpacity={0} />
  </radialGradient>
)

function Moon({ x, y, full }: { x: number; y: number; full: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={70} fill="url(#cel-moonglow)" />
      {full ? (
        <>
          <circle r={26} fill="#f4ecd6" />
          <circle cx={-8} cy={-6} r={5} fill="#e2d6b8" />
          <circle cx={9} cy={8} r={7} fill="#e5dabd" />
          <circle cx={6} cy={-12} r={3} fill="#e2d6b8" />
        </>
      ) : (
        <>
          <mask id="cel-crescent">
            <rect x={-40} y={-40} width={80} height={80} fill="#fff" />
            <circle cx={11} cy={-7} r={24} fill="#000" />
          </mask>
          <circle r={26} fill="#f4ecd6" mask="url(#cel-crescent)" />
        </>
      )}
    </g>
  )
}

function FourPoint({ x, y, size, color, opacity = 1 }: { x: number; y: number; size: number; color: string; opacity?: number }) {
  const s = size
  const w = s * 0.14
  return <path transform={`translate(${x} ${y})`} d={`M0 ${-s} L${w} ${-w} L${s} 0 L${w} ${w} L0 ${s} L${-w} ${w} L${-s} 0 L${-w} ${-w} Z`} fill={color} opacity={opacity} />
}

export function CelestialDefs() {
  return (
    <defs>
      <Glow id="cel-moonglow" color="#f4ecd6" r={0.45} />
      <Glow id="cel-warm" color="#ffd89a" />
      <Glow id="cel-cool" color="#a8c8ff" />
      <Glow id="cel-white" color="#ffffff" />
      <Glow id="cel-rose" color="#ff8fcf" r={0.5} />
      <Glow id="cel-violet" color="#9f8cff" r={0.5} />
      <linearGradient id="cel-aurora" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0%" stopColor="#5cf2c0" stopOpacity={0} />
        <stop offset="30%" stopColor="#5cf2c0" stopOpacity={0.35} />
        <stop offset="60%" stopColor="#7aa8ff" stopOpacity={0.28} />
        <stop offset="100%" stopColor="#b98cff" stopOpacity={0} />
      </linearGradient>
      <linearGradient id="cel-tail" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0%" stopColor="#bfe3ff" stopOpacity={0} />
        <stop offset="100%" stopColor="#e8f4ff" stopOpacity={0.8} />
      </linearGradient>
      <filter id="cel-blur" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="18" />
      </filter>
      <filter id="cel-soft" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" />
      </filter>
    </defs>
  )
}

/** Render every unlocked object. Positions are authored for a 1000-wide sky and scaled to `width`. */
export function CelestialLayer({ unlocked, width = 1000 }: { unlocked: Set<CelestialId>; width?: number }) {
  const has = (id: CelestialId) => unlocked.has(id)
  const sx = width / 1000
  const X = (x: number) => x * sx
  return (
    <g aria-hidden="true">
      {has('milky-way') && (
        <g opacity={0.5} transform={`scale(${sx} 1)`}>
          <path d="M-50 520 C 250 380, 600 300, 1050 60" stroke="#dfe6ff" strokeWidth={120} strokeOpacity={0.05} fill="none" filter="url(#cel-blur)" />
          <path d="M-50 520 C 250 380, 600 300, 1050 60" stroke="#ffffff" strokeWidth={50} strokeOpacity={0.05} fill="none" filter="url(#cel-blur)" />
        </g>
      )}
      {has('nebula') && (
        <g opacity={0.6} transform={`scale(${sx} 1)`}>
          <ellipse cx={330} cy={380} rx={170} ry={90} fill="url(#cel-rose)" filter="url(#cel-blur)" />
          <ellipse cx={420} cy={340} rx={130} ry={80} fill="url(#cel-violet)" filter="url(#cel-blur)" />
        </g>
      )}
      {has('aurora') && (
        <g filter="url(#cel-soft)" opacity={0.9} transform={`scale(${sx} 1)`}>
          <path d="M0 150 C 180 90, 320 170, 520 110 S 860 60, 1000 120 L1000 60 C 850 20, 640 70, 480 50 S 150 40, 0 90 Z" fill="url(#cel-aurora)" />
        </g>
      )}
      {has('galaxy') && (
        <g transform={`translate(${X(120)} 440) rotate(-25)`} opacity={0.75}>
          <ellipse rx={60} ry={18} fill="url(#cel-white)" opacity={0.35} />
          <ellipse rx={40} ry={11} fill="none" stroke="#e8e0ff" strokeOpacity={0.35} strokeWidth={1.2} transform="rotate(12)" />
          <ellipse rx={56} ry={16} fill="none" stroke="#e8e0ff" strokeOpacity={0.2} strokeWidth={1} transform="rotate(-8)" />
          <circle r={4} fill="#fff" />
        </g>
      )}
      {has('ringed-planet') && (
        <g transform={`translate(${X(860)} 430)`}>
          <circle r={40} fill="url(#cel-warm)" opacity={0.4} />
          <circle r={17} fill="#e9c38c" />
          <path d="M-17 2 A17 17 0 0 0 17 2" fill="#c99d63" opacity={0.6} />
          <ellipse rx={32} ry={7} fill="none" stroke="#f4dcae" strokeWidth={2.5} strokeOpacity={0.8} transform="rotate(-18)" />
        </g>
      )}
      {(has('crescent') || has('full-moon')) && <Moon x={X(880)} y={96} full={has('full-moon')} />}
      {has('eclipse') && (
        <g transform={`translate(${X(700)} 70)`}>
          <circle r={26} fill="url(#cel-white)" opacity={0.7} />
          <circle r={13} fill="none" stroke="#fff" strokeOpacity={0.7} strokeWidth={2} />
          <circle r={12} fill="#05060a" />
        </g>
      )}
      {has('comet') && (
        <g transform={`translate(${X(250)} 130) rotate(18)`}>
          <path d="M-150 -6 L0 -3 L0 3 L-150 6 Z" fill="url(#cel-tail)" />
          <circle r={5} fill="#f1f8ff" />
          <circle r={16} fill="url(#cel-cool)" />
        </g>
      )}
      {has('pole-star') && (
        <g>
          <circle cx={X(500)} cy={42} r={30} fill="url(#cel-warm)" opacity={0.6} />
          <FourPoint x={X(500)} y={42} size={16} color="#fff5dc" />
        </g>
      )}
      {has('binary') && (
        <g>
          <circle cx={X(132)} cy={70} r={16} fill="url(#cel-cool)" />
          <circle cx={X(132) + 16} cy={78} r={14} fill="url(#cel-warm)" />
          <circle cx={X(132)} cy={70} r={2.6} fill="#d9e7ff" />
          <circle cx={X(132) + 16} cy={78} r={2.2} fill="#ffe7c2" />
        </g>
      )}
      {has('supernova') && (
        <g transform={`translate(${X(950)} 300)`}>
          <circle r={60} fill="url(#cel-white)" opacity={0.6} />
          <FourPoint x={0} y={0} size={26} color="#ffffff" />
          <FourPoint x={0} y={0} size={14} color="#ffe9b0" opacity={0.8} />
        </g>
      )}
      {has('meteor-shower') && (
        <g stroke="#eaf2ff" strokeLinecap="round" opacity={0.45} transform={`scale(${sx} 1)`}>
          {[
            [40, 30],
            [90, 60],
            [30, 110],
            [150, 20],
            [200, 50],
          ].map(([x, y], i) => (
            <line key={i} x1={x} y1={y} x2={x + 38} y2={y + 16} strokeWidth={1.2} strokeOpacity={0.7 - i * 0.1} />
          ))}
        </g>
      )}
      {has('shooting-stars') && (
        <g className="sky-shooting" stroke="#ffffff" strokeLinecap="round">
          <line x1={X(600)} y1={60} x2={X(600) + 90} y2={100} strokeWidth={1.6} />
        </g>
      )}
    </g>
  )
}

/** Small standalone icon for the milestones collection. */
export function CelestialIcon({ id, locked }: { id: CelestialId; locked: boolean }) {
  const view: Record<CelestialId, [number, number]> = {
    'first-light': [500, 280],
    binary: [140, 74],
    crescent: [880, 96],
    'full-moon': [880, 96],
    'shooting-stars': [645, 80],
    'pole-star': [500, 42],
    aurora: [500, 100],
    comet: [210, 118],
    'meteor-shower': [110, 70],
    'ringed-planet': [860, 430],
    'milky-way': [500, 300],
    nebula: [370, 360],
    eclipse: [700, 70],
    galaxy: [120, 440],
    supernova: [950, 300],
  }
  const [cx, cy] = view[id]
  const size = id === 'aurora' || id === 'milky-way' ? 520 : id === 'nebula' ? 380 : id === 'comet' ? 200 : 110
  return (
    <svg viewBox={`${cx - size / 2} ${cy - size / 2} ${size} ${size}`} className="size-full" aria-hidden="true" style={{ filter: locked ? 'grayscale(1) brightness(0.55)' : undefined, opacity: locked ? 0.45 : 1 }}>
      <CelestialDefs />
      {id === 'first-light' ? (
        <g>
          <circle cx={500} cy={280} r={30} fill="url(#cel-warm)" />
          <FourPoint x={500} y={280} size={18} color="#fff3d6" />
        </g>
      ) : (
        <CelestialLayer unlocked={new Set([id])} />
      )}
    </svg>
  )
}
