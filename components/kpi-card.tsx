'use client'

import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: string | number
  change?: number
  prefix?: string
  suffix?: string
  accent?: 'green' | 'blue' | 'amber' | 'default'
  subtext?: string
  compact?: boolean
}

const accentBorder: Record<NonNullable<KpiCardProps['accent']>, string> = {
  green: 'border-l-2 border-l-green-500',
  blue: 'border-l-2 border-l-blue-500',
  amber: 'border-l-2 border-l-amber-500',
  default: '',
}

export function KpiCard({ label, value, change, prefix, suffix, accent = 'default', subtext, compact = false }: KpiCardProps) {
  const borderClass = accentBorder[accent]

  const renderChange = () => {
    if (change === undefined) return null
    if (change === 0) return <span className="text-[10px] text-[#636780]">—</span>
    const isPositive = change > 0
    return (
      <div className="flex items-center gap-0.5">
        {isPositive
          ? <ArrowUpRight size={compact ? 11 : 14} className="text-green-400" />
          : <ArrowDownRight size={compact ? 11 : 14} className="text-red-400" />}
        <span className={`text-[10px] ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}{change.toFixed(1)}%
        </span>
      </div>
    )
  }

  if (compact) {
    return (
      <div className={`rounded-xl border border-[#1c2035] bg-[#10121a] p-3.5 ${borderClass}`}>
        <p className="text-[10px] font-medium text-[#636780] uppercase tracking-wider mb-2">{label}</p>
        <p className="text-xl font-bold tabular-nums text-[#e4e6f0] mb-1.5">
          {prefix && <span className="text-[#636780] text-base">{prefix}</span>}
          {value}
          {suffix && <span className="text-[#636780] text-base">{suffix}</span>}
        </p>
        {renderChange()}
      </div>
    )
  }

  return (
    <div className={`rounded-xl border border-[#1c2035] bg-[#10121a] p-5 ${borderClass}`}>
      <p className="text-xs font-medium text-[#636780] uppercase tracking-wider mb-3">{label}</p>
      <p className="text-3xl font-bold tabular-nums text-[#e4e6f0]">
        {prefix && <span className="text-[#636780]">{prefix}</span>}
        {value}
        {suffix && <span className="text-[#636780]">{suffix}</span>}
      </p>
      {subtext && <p className="mt-1 text-xs text-[#636780]">{subtext}</p>}
      {change !== undefined && (
        <div className="mt-2 flex items-center gap-1">
          {renderChange()}
          <span className="text-[9px] text-[#636780] ml-1">vs prev period</span>
        </div>
      )}
    </div>
  )
}
