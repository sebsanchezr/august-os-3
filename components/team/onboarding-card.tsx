'use client'

import type { StaffOnboardingListItem } from '@/lib/team-client'

type Props = {
  onboarding: StaffOnboardingListItem
  onClick: () => void
  onDragStart: (e: React.DragEvent) => void
  dragging: boolean
}

const ROLE_LABEL: Record<string, string> = {
  cold_caller: 'Cold Caller',
  sales_manager: 'Sales Manager',
  other: 'Other',
}

export default function OnboardingCard({ onboarding, onClick, onDragStart, dragging }: Props) {
  const name = onboarding.team_member?.name ?? onboarding.candidate_name ?? 'Unnamed'

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={`group bg-[#181b27] rounded-lg border border-[#1c2035] p-3 cursor-pointer transition-all select-none
        hover:border-indigo-500/40 hover:bg-[#1c2030]
        ${dragging ? 'opacity-40' : 'opacity-100'}`}
    >
      <p className="text-[13px] font-medium text-[#e4e6f0] leading-snug mb-1.5">{name}</p>

      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
          {ROLE_LABEL[onboarding.role] ?? onboarding.role}
        </span>
        <span className="text-[10px] font-medium tabular-nums text-[#636780]">
          {onboarding.task_done_count}/{onboarding.task_count}
        </span>
      </div>
    </div>
  )
}
