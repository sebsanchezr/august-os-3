'use client'

import { useState } from 'react'
import type { StaffOnboardingListItem, OnboardingStage } from '@/lib/team-client'
import OnboardingCard from './onboarding-card'

type Props = {
  stage: OnboardingStage
  label: string
  items: StaffOnboardingListItem[]
  draggingId: string | null
  onCardClick: (item: StaffOnboardingListItem) => void
  onCardDragStart: (item: StaffOnboardingListItem) => void
  onDropToColumn: (stage: OnboardingStage) => void
}

export default function OnboardingColumn({
  stage,
  label,
  items,
  draggingId,
  onCardClick,
  onCardDragStart,
  onDropToColumn,
}: Props) {
  const [isOver, setIsOver] = useState(false)

  return (
    <div className="flex flex-col rounded-xl border border-[#1c2035] bg-[#10121a] min-w-[220px] flex-1">
      <div className="px-3 py-2.5 border-b border-[#1c2035] flex items-center justify-between">
        <span className="text-[13px] font-medium text-[#a9adc4]">{label}</span>
        <span className="text-[11px] bg-[#181b27] text-[#636780] px-1.5 py-0.5 rounded-full tabular-nums min-w-[20px] text-center">
          {items.length}
        </span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!isOver) setIsOver(true)
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsOver(false)
          onDropToColumn(stage)
        }}
        className={`flex-1 p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-220px)] overflow-y-auto transition-colors rounded-b-xl
          ${isOver ? 'bg-indigo-500/5 ring-1 ring-inset ring-indigo-500/30' : ''}`}
      >
        {items.length === 0 && !isOver && (
          <p className="text-[11px] text-[#3d4060] text-center pt-4 select-none">Empty</p>
        )}
        {items.map((item) => (
          <OnboardingCard
            key={item.id}
            onboarding={item}
            dragging={draggingId === item.id}
            onClick={() => onCardClick(item)}
            onDragStart={() => onCardDragStart(item)}
          />
        ))}
      </div>
    </div>
  )
}
