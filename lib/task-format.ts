import type { TaskDepartment, TaskPriority, TaskStatus } from '@/lib/types'

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Deterministic avatar colour from a name, so each person keeps the same colour.
const AVATAR_COLOURS = [
  'bg-indigo-500/20 text-indigo-300',
  'bg-sky-500/20 text-sky-300',
  'bg-emerald-500/20 text-emerald-300',
  'bg-amber-500/20 text-amber-300',
  'bg-rose-500/20 text-rose-300',
  'bg-violet-500/20 text-violet-300',
  'bg-cyan-500/20 text-cyan-300',
]

export function avatarColour(name: string | null | undefined): string {
  if (!name) return 'bg-[#181b27] text-[#636780]'
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLOURS[Math.abs(hash) % AVATAR_COLOURS.length]
}

export const DEPARTMENT_LABELS: Record<TaskDepartment, string> = {
  creative: 'Creative',
  paid_ads: 'Paid Ads',
  client: 'Client',
  company: 'Company',
  admin: 'Admin',
  ceo: 'CEO',
}

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  brief: 'Brief',
  editing: 'Editing',
  revision: 'Revision',
  sent_for_approval: 'Sent for Approval',
  approved_by_client: 'Approved by Client',
  sent_to_media_buyer: 'Sent to Media Buyer',
  live: 'Live',
  in_progress: 'In Progress',
  review: 'Review',
  completed: 'Completed',
}

// Column accent colours per status, used for headers and card left borders.
export const STATUS_ACCENT: Record<TaskStatus, string> = {
  brief: 'text-[#8b8fa8]',
  editing: 'text-sky-400',
  revision: 'text-amber-400',
  sent_for_approval: 'text-fuchsia-400',
  approved_by_client: 'text-violet-400',
  sent_to_media_buyer: 'text-blue-400',
  live: 'text-emerald-400',
  in_progress: 'text-indigo-400',
  review: 'text-amber-400',
  completed: 'text-emerald-400',
}

type DueInfo = { label: string; tone: 'overdue' | 'today' | 'soon' | 'normal' }

// Returns a compact relative due-date label plus a tone for colouring.
export function formatDue(due: string | null): DueInfo | null {
  if (!due) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(due + 'T00:00:00')
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000)

  let tone: DueInfo['tone'] = 'normal'
  if (diffDays < 0) tone = 'overdue'
  else if (diffDays === 0) tone = 'today'
  else if (diffDays <= 2) tone = 'soon'

  let label: string
  if (diffDays === 0) label = 'Today'
  else if (diffDays === 1) label = 'Tomorrow'
  else if (diffDays === -1) label = 'Yesterday'
  else if (diffDays < 0) label = `${Math.abs(diffDays)}d overdue`
  else label = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  return { label, tone }
}

export const DUE_TONE_CLASS: Record<DueInfo['tone'], string> = {
  overdue: 'text-rose-400',
  today: 'text-amber-400',
  soon: 'text-[#a9adc4]',
  normal: 'text-[#636780]',
}

// Due-date colour for a task, accounting for status. A terminal status means
// the deliverable shipped (creative 'live', ops 'completed'), so an overdue due
// date reads green instead of red. Everything else follows DUE_TONE_CLASS.
export function dueColorClass(task: { due_date: string | null; status: TaskStatus }): string {
  const due = formatDue(task.due_date)
  if (!due) return ''
  if (due.tone === 'overdue' && (task.status === 'live' || task.status === 'completed')) {
    return 'text-green-400'
  }
  return DUE_TONE_CLASS[due.tone]
}

export function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
