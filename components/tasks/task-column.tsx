'use client'

import { useState } from 'react'
import type { Task, TaskStatus } from '@/lib/types'
import { STATUS_ACCENT } from '@/lib/task-format'
import TaskCard from './task-card'

type Props = {
  status: TaskStatus
  label: string
  tasks: Task[]
  draggingId: string | null
  onCardClick: (task: Task) => void
  onCardDragStart: (task: Task) => void
  onDropToColumn: (status: TaskStatus) => void
}

export default function TaskColumn({
  status,
  label,
  tasks,
  draggingId,
  onCardClick,
  onCardDragStart,
  onDropToColumn,
}: Props) {
  const [isOver, setIsOver] = useState(false)

  return (
    <div className="flex flex-col rounded-xl border border-[#1c2035] bg-[#10121a] min-w-[240px] flex-1">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[#1c2035] flex items-center justify-between">
        <span className={`text-[13px] font-medium ${STATUS_ACCENT[status]}`}>{label}</span>
        <span className="text-[11px] bg-[#181b27] text-[#636780] px-1.5 py-0.5 rounded-full tabular-nums min-w-[20px] text-center">
          {tasks.length}
        </span>
      </div>

      {/* Drop zone + cards */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!isOver) setIsOver(true)
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsOver(false)
          onDropToColumn(status)
        }}
        className={`flex-1 p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-220px)] overflow-y-auto transition-colors rounded-b-xl
          ${isOver ? 'bg-indigo-500/5 ring-1 ring-inset ring-indigo-500/30' : ''}`}
      >
        {tasks.length === 0 && !isOver && (
          <p className="text-[11px] text-[#3d4060] text-center pt-4 select-none">Empty</p>
        )}
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            dragging={draggingId === task.id}
            onClick={() => onCardClick(task)}
            onDragStart={() => onCardDragStart(task)}
          />
        ))}
      </div>
    </div>
  )
}
