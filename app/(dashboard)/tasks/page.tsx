'use client'

import dynamic from 'next/dynamic'

// Board is client-only (drag-drop, keyboard shortcuts, live state).
const TaskBoard = dynamic(() => import('@/components/tasks/task-board'), { ssr: false })

export default function TasksBoardPage() {
  return <TaskBoard />
}
