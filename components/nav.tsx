'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, ClipboardList, KanbanSquare, BookOpen, LogOut, Zap,
  Home, FileText, Linkedin, Mail, TrendingUp, Lock, Inbox, Users,
} from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { useEffect, useState } from 'react'

const coldCallingItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'EOD Reports', href: '/eod', icon: ClipboardList },
  { label: 'Pipeline', href: '/pipeline', icon: KanbanSquare },
  { label: 'Resources', href: '/resources', icon: BookOpen },
]

const coldEmailItems = [
  { label: 'Dashboard', href: '/cold-email', icon: LayoutDashboard },
  { label: 'Pipeline', href: '/cold-email/pipeline', icon: KanbanSquare },
  { label: 'Replies', href: '/cold-email/replies', icon: Inbox },
  { label: 'Leads', href: '/cold-email/leads', icon: Users },
]

const comingSoonItems = [
  { label: 'Gov Contracts', icon: FileText },
  { label: 'LinkedIn', icon: Linkedin },
  { label: 'Revenue', icon: TrendingUp },
]

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[9px] font-semibold tracking-[0.13em] text-[#3d4060] uppercase px-3 pt-4 pb-1">
      {children}
    </p>
  )
}

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = getSupabaseBrowser()
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null)
    })
  }, [])

  async function handleSignOut() {
    const supabase = getSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="flex flex-col w-52 min-h-screen bg-[#0c0d11] border-r border-[#1c2035] shrink-0">
      {/* Logo */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-[26px] h-[26px] rounded-md bg-indigo-600 flex items-center justify-center shrink-0">
            <Zap className="text-white" style={{ width: 13, height: 13 }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#e4e6f0] leading-none">August OS</p>
            <p className="text-[9px] text-[#636780] mt-0.5 leading-none">Marketing Operations</p>
          </div>
        </div>
      </div>

      <div className="border-t border-[#1c2035]" />

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto">
        {/* Overview */}
        <Link
          href="/overview"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
            isActive('/overview')
              ? 'bg-[#181b27] text-[#e4e6f0] font-medium'
              : 'text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27]'
          }`}
        >
          <Home className="h-[15px] w-[15px] shrink-0" />
          Overview
        </Link>

        {/* Cold Calling */}
        <SectionLabel>Cold Calling</SectionLabel>
        {coldCallingItems.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive(href)
                ? 'bg-[#181b27] text-[#e4e6f0] font-medium'
                : 'text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27]'
            }`}
          >
            <Icon className="h-[15px] w-[15px] shrink-0" />
            {label}
          </Link>
        ))}

        {/* Cold Email */}
        <SectionLabel>Cold Email</SectionLabel>
        {coldEmailItems.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive(href)
                ? 'bg-[#181b27] text-[#e4e6f0] font-medium'
                : 'text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27]'
            }`}
          >
            <Icon className="h-[15px] w-[15px] shrink-0" />
            {label}
          </Link>
        ))}

        {/* Coming soon */}
        <SectionLabel>Coming Soon</SectionLabel>
        {comingSoonItems.map(({ label, icon: Icon }) => (
          <div
            key={label}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[#2e3050] cursor-not-allowed select-none"
          >
            <Icon className="h-[15px] w-[15px] shrink-0" />
            <span>{label}</span>
            <Lock className="h-[10px] w-[10px] ml-auto shrink-0 opacity-50" />
          </div>
        ))}
      </nav>

      {/* Bottom: user + sign out */}
      <div className="p-3 border-t border-[#1c2035]">
        {userEmail && (
          <p className="text-[11px] text-[#636780] truncate px-3 mb-2">{userEmail}</p>
        )}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27] transition-colors"
        >
          <LogOut className="h-[14px] w-[14px] shrink-0" />
          Sign Out
        </button>
      </div>
    </div>
  )
}
