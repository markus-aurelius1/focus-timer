/**
 * Small, dependency-free SVG charts following one set of specs:
 * thin columns (≤24px, 4px rounded data-end, square baseline), hairline solid
 * grid, one validated chart hue for magnitude, text in ink tokens, a per-mark
 * hover/focus tooltip, and a table-view twin for every chart.
 */
import { Table2, ChartColumn } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { formatHoursShort } from '@/lib/time'

// ───────────────────────── scale helpers ─────────────────────────

const STEPS = [60, 300, 600, 900, 1800, 3600, 7200, 10800, 18000, 36000, 72000, 180000, 360000, 720000, 1800000]

/** Nice axis ticks for a duration in seconds. */
export function niceTicks(max: number, count = 3): number[] {
  const step = STEPS.find((s) => s * count >= max) ?? STEPS[STEPS.length - 1]
  return Array.from({ length: count + 1 }, (_, i) => i * step)
}

export const fmtSeconds = (s: number) => (s <= 0 ? '0' : formatHoursShort(s))

/** Track an element's width so SVG charts render at real pixel size (no stretched text). */
function useWidth<T extends HTMLElement>(fallback = 600) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth || fallback)
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(120, Math.round(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [fallback])
  return [ref, width] as const
}

// ───────────────────────── card with table view ─────────────────────────

export interface Datum {
  key: string
  label: string
  /** Short axis label (defaults to label). */
  tick?: string
  value: number
}

export function ChartCard({ title, subtitle, children, table, action, className }: { title: string; subtitle?: ReactNode; children: ReactNode; table?: Array<[string, string]>; action?: ReactNode; className?: string }) {
  const [asTable, setAsTable] = useState(false)
  return (
    <section className={cn('min-w-0 border-t border-line py-5 sm:py-6', className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[13px] text-ink-2">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {action}
          {table && (
            <button type="button" onClick={() => setAsTable((v) => !v)} className="rounded-full p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label={asTable ? 'Show chart' : 'Show as table'} title={asTable ? 'Show chart' : 'Show as table'}>
              {asTable ? <ChartColumn className="size-4" /> : <Table2 className="size-4" />}
            </button>
          )}
        </div>
      </div>
      {asTable && table ? <DataTable rows={table} /> : children}
    </section>
  )
}

function DataTable({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="scrollbar-thin max-h-72 overflow-y-auto">
      <table className="w-full text-[13px]">
        <tbody>
          {rows.map(([k, v], i) => (
            <tr key={`${k}-${i}`} className="border-b border-line last:border-0">
              <td className="py-1.5 text-ink-2">{k}</td>
              <td className="tabular py-1.5 text-right font-semibold">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ───────────────────────── tooltip ─────────────────────────

function Tooltip({ x, y, value, label, containerWidth }: { x: number; y: number; value: string; label: string; containerWidth: number }) {
  const w = 132
  const left = Math.max(0, Math.min(containerWidth - w, x - w / 2))
  return (
    <div className="pointer-events-none absolute z-10 rounded-xl border border-line bg-surface px-3 py-2 shadow-lift" style={{ left, top: Math.max(0, y - 58), width: w }} role="status">
      <p className="text-[15px] leading-tight font-bold">{value}</p>
      <p className="truncate text-xs text-ink-2">{label}</p>
    </div>
  )
}

// ───────────────────────── column chart ─────────────────────────

export function ColumnChart({
  data,
  height = 168,
  highlight,
  reference,
  referenceLabel,
  formatValue = fmtSeconds,
  tickEvery = 1,
  ariaLabel,
  emphasize = false,
}: {
  data: Datum[]
  height?: number
  highlight?: string
  /** Dim every bar except the highlighted one (use when the highlight *is* the story). */
  emphasize?: boolean
  /** Optional target line (e.g. daily goal), same units as value. */
  reference?: number
  referenceLabel?: string
  formatValue?: (v: number) => string
  tickEvery?: number
  ariaLabel: string
}) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const padL = 34
  const padB = 22
  const plotH = height - padB
  const max = Math.max(1, ...data.map((d) => d.value), reference ?? 0)
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1]
  const slot = (W - padL) / Math.max(1, data.length)
  const barW = Math.min(24, Math.max(3, slot * 0.62))
  const y = (v: number) => plotH - (v / top) * (plotH - 8)

  return (
    <div ref={ref} className="relative w-full min-w-0" onPointerLeave={() => setHover(null)}>
      <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} className="block overflow-visible" role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <text x={padL - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-3 text-[10px] font-semibold" style={{ fontSize: 10 }}>
              {formatValue(t)}
            </text>
          </g>
        ))}
        {reference !== undefined && reference > 0 && (
          <g>
            <line x1={padL} x2={W} y1={y(reference)} y2={y(reference)} stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="3 4" vectorEffect="non-scaling-stroke" opacity={0.7} />
            {referenceLabel && (
              <text x={W} y={y(reference) - 4} textAnchor="end" className="fill-ink-2 font-semibold" style={{ fontSize: 10 }}>
                {referenceLabel}
              </text>
            )}
          </g>
        )}
        {data.map((d, i) => {
          const cx = padL + slot * i + slot / 2
          const h = Math.max(0, plotH - y(d.value))
          const r = Math.min(4, barW / 2, h)
          const x0 = cx - barW / 2
          const active = hover === i
          const emph = !emphasize || highlight === undefined || highlight === d.key
          // Rounded data-end, square baseline.
          const path = h <= 0 ? '' : `M${x0},${plotH} V${plotH - h + r} Q${x0},${plotH - h} ${x0 + r},${plotH - h} H${x0 + barW - r} Q${x0 + barW},${plotH - h} ${x0 + barW},${plotH - h + r} V${plotH} Z`
          return (
            <g key={d.key}>
              {h > 0 && <path d={path} fill="var(--chart)" opacity={active ? 1 : emph ? 0.9 : 0.4} />}
              {h <= 0 && <line x1={x0} x2={x0 + barW} y1={plotH - 0.5} y2={plotH - 0.5} stroke="var(--line-strong)" strokeWidth={1} />}
              {/* Hit target: the whole slot, not just the painted bar. */}
              <rect
                x={padL + slot * i}
                y={0}
                width={slot}
                height={plotH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${d.label}: ${formatValue(d.value)}`}
                onPointerEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="outline-none"
              />
              {(i % tickEvery === 0 || d.key === highlight) && (
                <text x={cx} y={height - 6} textAnchor="middle" className={cn(d.key === highlight ? 'fill-ink font-bold' : 'fill-ink-3 font-semibold')} style={{ fontSize: 10 }}>
                  {d.tick ?? d.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {hover !== null && data[hover] && (
        <Tooltip x={padL + slot * hover + slot / 2} y={y(data[hover].value)} value={formatValue(data[hover].value)} label={data[hover].label} containerWidth={W} />
      )}
    </div>
  )
}

// ───────────────────────── trend line ─────────────────────────

export function TrendLine({ data, height = 150, formatValue = fmtSeconds, ariaLabel }: { data: Datum[]; height?: number; formatValue?: (v: number) => string; ariaLabel: string }) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const gid = useId().replace(/:/g, '')
  const [hover, setHover] = useState<number | null>(null)
  const padL = 34
  const padR = 40
  const padB = 22
  const plotH = height - padB
  const max = Math.max(1, ...data.map((d) => d.value))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1]
  const x = (i: number) => padL + (data.length <= 1 ? 0 : (i / (data.length - 1)) * (W - padL - padR))
  const y = (v: number) => plotH - (v / top) * (plotH - 8)
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.value)}`).join(' ')
  const area = `${line} L${x(data.length - 1)},${plotH} L${x(0)},${plotH} Z`
  const last = data[data.length - 1]

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const i = Math.round(((px - padL) / (W - padL - padR)) * (data.length - 1))
    setHover(Math.max(0, Math.min(data.length - 1, i)))
  }

  return (
    <div ref={ref} className="relative w-full min-w-0">
      <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} className="block overflow-visible" role="img" aria-label={ariaLabel} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--chart)" stopOpacity={0.14} />
            <stop offset="100%" stopColor="var(--chart)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--line)" vectorEffect="non-scaling-stroke" />
            <text x={padL - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-3 font-semibold" style={{ fontSize: 10 }}>
              {formatValue(t)}
            </text>
          </g>
        ))}
        {data.length > 1 && (
          <>
            <path d={area} fill={`url(#${gid})`} />
            <path d={line} fill="none" stroke="var(--chart)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </>
        )}
        {data.map((d, i) =>
          i % Math.ceil(data.length / 6) === 0 || i === data.length - 1 ? (
            <text key={d.key} x={x(i)} y={height - 6} textAnchor="middle" className="fill-ink-3 font-semibold" style={{ fontSize: 10 }}>
              {d.tick ?? d.label}
            </text>
          ) : null,
        )}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={plotH} stroke="var(--ink-3)" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
        {last && (
          <text x={x(data.length - 1) + 10} y={y(last.value)} dy="0.32em" className="fill-ink font-bold" style={{ fontSize: 11 }}>
            {formatValue(last.value)}
          </text>
        )}
        {data.map((d, i) =>
          i === data.length - 1 || i === hover ? <circle key={d.key} cx={x(i)} cy={y(d.value)} r={4.5} fill="var(--chart)" stroke="var(--surface)" strokeWidth={2} /> : null,
        )}
      </svg>
      {hover !== null && data[hover] && <Tooltip x={x(hover)} y={y(data[hover].value)} value={formatValue(data[hover].value)} label={data[hover].label} containerWidth={W} />}
    </div>
  )
}

// ───────────────────────── horizontal bars (identity) ─────────────────────────

export interface BarRow {
  key: string
  label: string
  value: number
  color?: string
  sub?: string
}

/** Ranked horizontal bars. Every bar is directly labelled – colour is never the only identity channel. */
export function BarList({ rows, formatValue = fmtSeconds, limit = 8, empty }: { rows: BarRow[]; formatValue?: (v: number) => string; limit?: number; empty?: ReactNode }) {
  const [all, setAll] = useState(false)
  const max = Math.max(1, ...rows.map((r) => r.value))
  const total = rows.reduce((a, r) => a + r.value, 0)
  const shown = all ? rows : rows.slice(0, limit)
  if (!rows.length) return <>{empty}</>
  return (
    <div>
      <ul className="space-y-3">
        {shown.map((r) => (
          <li key={r.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
              <span className="flex min-w-0 items-center gap-2 font-semibold">
                <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: r.color ?? 'var(--chart)' }} />
                <span className="truncate">{r.label}</span>
                {r.sub && <span className="shrink-0 font-medium text-ink-3">{r.sub}</span>}
              </span>
              <span className="tabular shrink-0 font-bold">
                {formatValue(r.value)}
                <span className="ml-1.5 font-semibold text-ink-3">{total ? Math.round((r.value / total) * 100) : 0}%</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-2">
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(r.value / max) * 100}%`, background: r.color ?? 'var(--chart)' }} />
            </div>
          </li>
        ))}
      </ul>
      {rows.length > limit && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-3 text-xs font-bold text-accent">
          {all ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  )
}

// ───────────────────────── calendar heatmap ─────────────────────────

const HEAT_STEPS = [0, 22, 42, 64, 86, 100]

export function Heatmap({ days, values, weekStartsOn, formatValue = fmtSeconds, ariaLabel }: { days: string[]; values: Map<string, number>; weekStartsOn: 0 | 1; formatValue?: (v: number) => string; ariaLabel: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ day: string; x: number; y: number } | null>(null)
  const { weeks, max, months } = useMemo(() => {
    // Pad the start so columns are whole weeks.
    const first = new Date(days[0] + 'T12:00')
    const lead = (first.getDay() - weekStartsOn + 7) % 7
    const cells: Array<string | null> = [...Array(lead).fill(null), ...days]
    const weeks: Array<Array<string | null>> = []
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
    const vals = days.map((d) => values.get(d) ?? 0).filter((v) => v > 0).sort((a, b) => a - b)
    // Scale to the 95th percentile so one marathon day doesn't wash out the rest.
    const max = vals.length ? vals[Math.floor(vals.length * 0.95)] || vals[vals.length - 1] : 1
    const months: Array<{ i: number; label: string }> = []
    weeks.forEach((w, i) => {
      const d = w.find((x) => x && x.endsWith('-01')) ?? (i === 0 ? w.find(Boolean) : null)
      if (d) months.push({ i, label: new Date(d + 'T12:00').toLocaleString('en', { month: 'short' }) })
    })
    return { weeks, max, months }
  }, [days, values, weekStartsOn])

  const level = (v: number) => (v <= 0 ? 0 : Math.min(5, 1 + Math.floor((v / max) * 4.999)))
  const cell = 12
  const gap = 3

  return (
    <div ref={ref} className="relative">
      <div className="scrollbar-thin overflow-x-auto pb-1" dir="rtl">
        <div dir="ltr" className="inline-block">
          <div className="relative mb-1 h-4" style={{ width: weeks.length * (cell + gap) }}>
            {months.map((m) => (
              <span key={`${m.i}-${m.label}`} className="absolute text-[10px] font-semibold text-ink-3" style={{ left: m.i * (cell + gap) }}>
                {m.label}
              </span>
            ))}
          </div>
          <div className="flex" style={{ gap }} role="img" aria-label={ariaLabel}>
            {weeks.map((w, wi) => (
              <div key={wi} className="flex flex-col" style={{ gap }}>
                {Array.from({ length: 7 }, (_, di) => {
                  const d = w[di]
                  if (!d) return <span key={di} style={{ width: cell, height: cell }} />
                  const v = values.get(d) ?? 0
                  const lv = level(v)
                  return (
                    <span
                      key={di}
                      tabIndex={-1}
                      onPointerEnter={(e) => {
                        const r = (e.target as HTMLElement).getBoundingClientRect()
                        const pr = ref.current!.getBoundingClientRect()
                        setHover({ day: d, x: r.left - pr.left + cell / 2, y: r.top - pr.top })
                      }}
                      onPointerLeave={() => setHover(null)}
                      className="rounded-[3px]"
                      style={{ width: cell, height: cell, background: lv === 0 ? 'var(--surface-2)' : `color-mix(in oklab, var(--chart) ${HEAT_STEPS[lv]}%, var(--surface-2))` }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] font-semibold text-ink-3">
        Less
        {[0, 1, 2, 3, 4, 5].map((l) => (
          <span key={l} className="size-2.5 rounded-[3px]" style={{ background: l === 0 ? 'var(--surface-2)' : `color-mix(in oklab, var(--chart) ${HEAT_STEPS[l]}%, var(--surface-2))` }} />
        ))}
        More
      </div>
      {hover && <Tooltip x={hover.x} y={hover.y + 8} value={formatValue(values.get(hover.day) ?? 0)} label={new Date(hover.day + 'T12:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} containerWidth={ref.current?.clientWidth ?? 600} />}
    </div>
  )
}

// ───────────────────────── stat tile ─────────────────────────

export function StatTile({ label, value, delta, deltaGood = true, sub }: { label: string; value: string; delta?: number | null; deltaGood?: boolean; sub?: string }) {
  const showDelta = delta !== undefined && delta !== null && Number.isFinite(delta)
  const up = (delta ?? 0) >= 0
  const good = up === deltaGood
  return (
    <div className="min-w-0 border-l-2 border-line px-4 py-2">
      <p className="text-xs font-semibold text-ink-2">{label}</p>
      <p className="tabular mt-1 text-[26px] leading-tight font-semibold tracking-tight">{value}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-ink-3">
        {showDelta && (
          <span className={cn('font-bold', Math.abs(delta!) < 0.005 ? 'text-ink-3' : good ? 'text-success' : 'text-danger')}>
            {up ? '▲' : '▼'} {Math.abs(Math.round(delta! * 100))}%
          </span>
        )}
        {sub}
      </p>
    </div>
  )
}
