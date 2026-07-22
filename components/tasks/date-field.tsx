'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'

// Custom popover calendar. Replaces native <input type="date">, which in a small
// styled cell had a tiny calendar-icon hit target (needed several clicks to open)
// and inconsistent commit behaviour. This opens on a single click anywhere on the
// trigger and fires onChange with a 'yyyy-mm-dd' string (or '' when cleared).

type Props = {
  value: string | null | undefined   // 'yyyy-mm-dd' or empty
  onChange: (value: string) => void   // '' means cleared
  className?: string                  // styles the trigger button
  placeholder?: string
  align?: 'left' | 'right'
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// Parse 'yyyy-mm-dd' into a local Date (avoids the UTC shift new Date('yyyy-mm-dd') causes).
function parseYmd(s: string | null | undefined): Date | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function toYmd(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Days to render for a month grid, Monday-first, padded with leading/trailing nulls.
function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7 // 0 = Monday
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export default function DateField({ value, onChange, className, placeholder = 'Set date', align = 'left' }: Props) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const selected = useMemo(() => parseYmd(value), [value])
  const [viewDate, setViewDate] = useState(() => selected ?? new Date())
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  useEffect(() => { setMounted(true) }, [])

  // Anchor the fixed-position popover under the trigger, clamped to the viewport.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const POP_W = 252
    const POP_H = 300
    const update = () => {
      const r = triggerRef.current!.getBoundingClientRect()
      let left = align === 'right' ? r.right - POP_W : r.left
      left = Math.max(8, Math.min(left, window.innerWidth - POP_W - 8))
      let top = r.bottom + 4
      if (top + POP_H > window.innerHeight - 8) top = Math.max(8, r.top - POP_H - 4)
      setPos({ top, left })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, align])

  // Re-centre the visible month on the selected date whenever the picker opens.
  useEffect(() => {
    if (open) setViewDate(selected ?? new Date())
  }, [open, selected])

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      // Popover is portalled outside wrapRef, so check it separately.
      if (wrapRef.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const today = new Date()
  const cells = monthGrid(viewDate.getFullYear(), viewDate.getMonth())

  const label = selected
    ? selected.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : placeholder

  function pick(d: Date) {
    onChange(toYmd(d))
    setOpen(false)
  }

  return (
    <div className="inline-block" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={className}
      >
        <CalendarDays style={{ width: 12, height: 12 }} className="shrink-0 opacity-60" />
        <span className={selected ? '' : 'text-[#636780]'}>{label}</span>
      </button>

      {open && mounted && createPortal(
        <div
          ref={popRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          className="z-[100] w-[228px] rounded-lg border border-[#1c2035] bg-[#141726] p-3 shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="text-[#636780] hover:text-[#e4e6f0] transition-colors rounded p-0.5"
              aria-label="Previous month"
            >
              <ChevronLeft style={{ width: 15, height: 15 }} />
            </button>
            <span className="text-[12px] font-medium text-[#e4e6f0]">
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button
              type="button"
              onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="text-[#636780] hover:text-[#e4e6f0] transition-colors rounded p-0.5"
              aria-label="Next month"
            >
              <ChevronRight style={{ width: 15, height: 15 }} />
            </button>
          </div>

          {/* Weekday row */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-[9px] font-medium text-[#3d4060] py-0.5">{w}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />
              const isSel = selected && sameDay(d, selected)
              const isToday = sameDay(d, today)
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(d)}
                  className={`h-6 rounded text-[11px] tabular-nums transition-colors ${
                    isSel
                      ? 'bg-indigo-600 text-white font-semibold'
                      : isToday
                        ? 'text-indigo-400 hover:bg-[#1c2035]'
                        : 'text-[#e4e6f0] hover:bg-[#1c2035]'
                  }`}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#1c2035]">
            <button
              type="button"
              onClick={() => pick(new Date())}
              className="text-[10px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Today
            </button>
            {selected && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false) }}
                className="flex items-center gap-1 text-[10px] font-medium text-[#636780] hover:text-red-400 transition-colors"
              >
                <X style={{ width: 10, height: 10 }} /> Clear
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
