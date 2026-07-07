'use client'

import { Trophy } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { CallerStats } from '@/lib/types'

interface LeaderboardTableProps {
  data: CallerStats[]
}

export function LeaderboardTable({ data }: LeaderboardTableProps) {
  const sorted = [...data].sort((a, b) => b.closed - a.closed)

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 text-[#636780] text-sm">
        No activity yet
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {['#', 'Caller', 'Calls', 'Positives', 'Booked', 'Closed', 'Revenue'].map((col) => (
              <th
                key={col}
                className="px-4 py-3 text-left text-xs font-medium text-[#636780] uppercase tracking-wider border-b border-[#1c2035]"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const isTop = i === 0
            return (
              <tr
                key={row.caller_id}
                className="border-b border-[#1c2035] last:border-0 hover:bg-[#181b27]/50 transition-colors"
              >
                {/* Rank */}
                <td className="px-4 py-3">
                  {isTop ? (
                    <Trophy size={12} className="text-amber-400" />
                  ) : (
                    <span className="text-xs text-[#636780]">{i + 1}</span>
                  )}
                </td>

                {/* Caller */}
                <td className="px-4 py-3 text-[#e4e6f0] font-medium whitespace-nowrap">
                  {row.caller_name}
                </td>

                {/* Calls */}
                <td className="px-4 py-3 text-[#e4e6f0] tabular-nums">
                  {row.calls.toLocaleString()}
                </td>

                {/* Positives */}
                <td className="px-4 py-3 text-[#e4e6f0] tabular-nums">
                  {row.positives.toLocaleString()}
                </td>

                {/* Booked */}
                <td className="px-4 py-3 text-[#e4e6f0] tabular-nums">
                  {row.booked.toLocaleString()}
                </td>

                {/* Closed */}
                <td className="px-4 py-3 tabular-nums">
                  <span className="text-[#e4e6f0] font-semibold">
                    {row.closed.toLocaleString()}
                  </span>
                </td>

                {/* Revenue */}
                <td className="px-4 py-3 tabular-nums">
                  <span className={row.revenue > 0 ? 'text-green-400' : 'text-[#636780]'}>
                    {formatCurrency(row.revenue)}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
