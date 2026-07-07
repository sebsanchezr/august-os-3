'use client'

import { Phone, Calendar, CheckCircle } from 'lucide-react'
import { timeAgo } from '@/lib/utils'
import type { RecentActivity } from '@/lib/types'

interface ActivityFeedProps {
  items: RecentActivity[]
}

const iconConfig = {
  call: {
    container: 'bg-blue-500/10',
    icon: Phone,
    iconClass: 'text-blue-400',
  },
  booking: {
    container: 'bg-green-500/10',
    icon: Calendar,
    iconClass: 'text-green-400',
  },
  deal: {
    container: 'bg-indigo-500/10',
    icon: CheckCircle,
    iconClass: 'text-indigo-400',
  },
} as const

export function ActivityFeed({ items }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 text-[#636780] text-sm">
        No recent activity
      </div>
    )
  }

  return (
    <div className="space-y-0 max-h-80 overflow-y-auto">
      {items.map((item) => {
        const config = iconConfig[item.type]
        const Icon = config.icon

        return (
          <div
            key={item.id}
            className="flex items-start gap-3 py-3 border-b border-[#1c2035] last:border-0"
          >
            {/* Icon */}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${config.container}`}
            >
              <Icon size={14} className={config.iconClass} />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[#e4e6f0]">{item.description}</p>
              <p className="text-xs text-[#636780] mt-0.5">
                {item.caller_name ? `${item.caller_name} · ` : ''}
                {timeAgo(item.created_at)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
