'use client'

import { MessageSquare, Repeat, Video } from 'lucide-react'
import type { Task } from '@/lib/types'
import { PRIORITY_COLOURS } from '@/lib/types'
import { initials, avatarColour, formatDue, dueColorClass } from '@/lib/task-format'

type Props = {
  task: Task
  onClick: () => void
  onDragStart: (e: React.DragEvent) => void
  dragging: boolean
}

export default function TaskCard({ task, onClick, onDragStart, dragging }: Props) {
  const assignee = task.profiles
  const collaborators = task.collaborator_profiles ?? []
  const due = formatDue(task.due_date)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={`group bg-[#181b27] rounded-lg border border-[#1c2035] p-3 cursor-pointer transition-all select-none
        hover:border-indigo-500/40 hover:bg-[#1c2030]
        ${dragging ? 'opacity-40' : 'opacity-100'}`}
    >
      {/* Priority dot + title */}
      <div className="flex items-start gap-2 mb-2">
        <span
          className="mt-1 h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: PRIORITY_COLOURS[task.priority] }}
          title={task.priority}
        />
        <p className="text-[13px] font-medium text-[#e4e6f0] leading-snug flex-1">{task.title}</p>
      </div>

      {/* Meta row: client chip + source icons */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        {task.clients && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            {task.clients.name}
          </span>
        )}
        {task.source === 'meeting' && (
          <span title="From meeting notes" className="text-[#636780]">
            <Video style={{ width: 11, height: 11 }} />
          </span>
        )}
        {task.recurrence && (
          <span title={`Repeats ${task.recurrence}`} className="text-[#636780]">
            <Repeat style={{ width: 11, height: 11 }} />
          </span>
        )}
      </div>

      {/* Bottom row: assignee + collaborator avatars, stacked, + due date */}
      <div className="flex items-center justify-between">
        <div className="flex items-center -space-x-1.5">
          {assignee ? (
            <span
              className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-semibold ring-2 ring-[#181b27] ${avatarColour(assignee.name)}`}
              title={assignee.name}
            >
              {initials(assignee.name)}
            </span>
          ) : (
            <span className="h-5 w-5 rounded-full border border-dashed border-[#2e3050] ring-2 ring-[#181b27]" title="Unassigned" />
          )}
          {collaborators.map((c) => (
            <span
              key={c.id}
              className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-semibold ring-2 ring-[#181b27] ${avatarColour(c.name)}`}
              title={c.name}
            >
              {initials(c.name)}
            </span>
          ))}
        </div>

        {due && (
          <span className={`text-[10px] font-medium tabular-nums ${dueColorClass(task)}`}>
            {due.label}
          </span>
        )}
      </div>
    </div>
  )
}
