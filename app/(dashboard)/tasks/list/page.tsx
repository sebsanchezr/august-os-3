'use client'

import dynamic from 'next/dynamic'

const TaskList = dynamic(() => import('@/components/tasks/task-list'), { ssr: false })

export default function TasksListPage() {
  return <TaskList />
}
