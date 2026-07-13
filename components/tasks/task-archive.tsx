'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Loader2, RotateCcw, Archive, Trash2 } from 'lucide-react'
import type { Task } from '@/lib/types'
import { useCurrentUserId, restoreTask } from '@/lib/tasks-client'
import { STATUS_LABELS, DEPARTMENT_LABELS, formatTimestamp } from '@/lib/task-format'

type Bucket = 'archived' | 'deleted'

export default function TaskArchive() {
  const currentUserId = useCurrentUserId()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [bucket, setBucket] = useState<Bucket>('archived')
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    const res = await fetch('/api/tasks?include_archived=true&include_deleted=true')
    if (res.ok) {
      const d = await res.json()
      setTasks(d.tasks ?? [])
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    refetch().finally(() => setLoading(false))
  }, [refetch])

  const rows = useMemo(() => {
    if (bucket === 'deleted') return tasks.filter((t) => t.deleted_at)
    return tasks.filter((t) => t.archived_at && !t.deleted_at)
  }, [tasks, bucket])

  async function handleRestore(id: string) {
    setRestoringId(id)
    try {
      await restoreTask(id, currentUserId)
      await refetch()
    } finally {
      setRestoringId(null)
    }
  }

  const archivedCount = tasks.filter((t) => t.archived_at && !t.deleted_at).length
  const deletedCount = tasks.filter((t) => t.deleted_at).length

  return (
    <div className="flex flex-col h-full p-5">
      <div className="mb-1">
        <h1 className="text-lg font-semibold text-[#e4e6f0]">Archive</h1>
        <p className="text-[12px] text-[#636780] mt-0.5">
          Completed tasks auto-archive after 7 days. Nothing is ever permanently deleted, everything here can be restored.
        </p>
      </div>

      {/* Bucket tabs */}
      <div className="flex bg-[#10121a] border border-[#1c2035] rounded-lg p-0.5 w-fit my-4">
        <button
          onClick={() => setBucket('archived')}
          className={`flex items-center gap-1.5 text-[11px] font-medium rounded-md px-3 py-1 transition-colors ${
            bucket === 'archived' ? 'bg-[#1c2035] text-[#e4e6f0]' : 'text-[#636780] hover:text-[#e4e6f0]'
          }`}
        >
          <Archive style={{ width: 12, height: 12 }} /> Archived
          <span className="text-[10px] text-[#636780] tabular-nums">{archivedCount}</span>
        </button>
        <button
          onClick={() => setBucket('deleted')}
          className={`flex items-center gap-1.5 text-[11px] font-medium rounded-md px-3 py-1 transition-colors ${
            bucket === 'deleted' ? 'bg-[#1c2035] text-[#e4e6f0]' : 'text-[#636780] hover:text-[#e4e6f0]'
          }`}
        >
          <Trash2 style={{ width: 12, height: 12 }} /> Deleted
          <span className="text-[10px] text-[#636780] tabular-nums">{deletedCount}</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-5 w-5 text-[#636780] animate-spin" />
        </div>
      ) : (
        <div className="rounded-xl border border-[#1c2035] bg-[#10121a] overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#1c2035] text-[11px] text-[#636780]">
                <th className="text-left font-medium px-3 py-2 w-[40%]">Task</th>
                <th className="text-left font-medium px-3 py-2">Track</th>
                <th className="text-left font-medium px-3 py-2">Status</th>
                <th className="text-left font-medium px-3 py-2">{bucket === 'deleted' ? 'Deleted' : 'Archived'}</th>
                <th className="text-right font-medium px-3 py-2">Restore</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={5} className="text-center text-[#3d4060] py-8">Nothing {bucket} yet</td></tr>
              )}
              {rows.map((task) => (
                <tr key={task.id} className="border-b border-[#1c2035]/60 hover:bg-[#151824] transition-colors">
                  <td className="px-3 py-2 text-[#a9adc4]">
                    {task.title}
                    <span className="ml-2 text-[10px] text-[#3d4060]">{DEPARTMENT_LABELS[task.department]}</span>
                  </td>
                  <td className="px-3 py-2 text-[#636780] capitalize">{task.track}</td>
                  <td className="px-3 py-2 text-[#636780]">{STATUS_LABELS[task.status]}</td>
                  <td className="px-3 py-2 text-[#636780] text-[11px]">
                    {formatTimestamp(bucket === 'deleted' ? task.deleted_at! : task.archived_at!)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => handleRestore(task.id)}
                      disabled={restoringId === task.id}
                      className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-md px-2 py-1 transition-colors disabled:opacity-50"
                    >
                      <RotateCcw style={{ width: 11, height: 11 }} /> Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
