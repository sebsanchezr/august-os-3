import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(n: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`
}

export function pctChange(current: number, prev: number): number {
  if (prev === 0) return 0
  return ((current - prev) / prev) * 100
}

export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks} week${weeks === 1 ? '' : 's'} ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
  const years = Math.floor(days / 365)
  return `${years} year${years === 1 ? '' : 's'} ago`
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-slate-700 text-slate-300',
    no_answer: 'bg-slate-700 text-slate-400',
    not_interested: 'bg-red-900/50 text-red-400',
    callback: 'bg-amber-900/50 text-amber-400',
    booked: 'bg-indigo-900/50 text-indigo-300',
    closed: 'bg-emerald-900/50 text-emerald-400',
    dead: 'bg-zinc-800 text-zinc-500',
    dial: 'bg-slate-700 text-slate-300',
    positive: 'bg-emerald-900/50 text-emerald-400',
    showed: 'bg-emerald-900/50 text-emerald-400',
    no_show: 'bg-red-900/50 text-red-400',
    lost: 'bg-zinc-800 text-zinc-500',
    deposit_paid: 'bg-amber-900/50 text-amber-400',
    paid: 'bg-emerald-900/50 text-emerald-400',
    live: 'bg-indigo-900/50 text-indigo-300',
  }
  return map[status] ?? 'bg-slate-700 text-slate-300'
}
