'use client'

import dynamic from 'next/dynamic'

const TaskArchive = dynamic(() => import('@/components/tasks/task-archive'), { ssr: false })

export default function TasksArchivePage() {
  return <TaskArchive />
}
