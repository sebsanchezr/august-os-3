'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, ClipboardList, KanbanSquare, BookOpen, LogOut, Zap,
  Home, FileText, Inbox, Users, MessageSquare, TrendingUp,
  CheckSquare, Archive, ChevronDown, Briefcase, AlertTriangle, CalendarDays, PhoneCall,
  Rocket, Globe, Sparkles,
} from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { useEffect, useState } from 'react'

// ─── Nav structure ────────────────────────────────────────────────────────────

type NavItem = { label: string; href: string; icon: React.ElementType }
type NavSection = { id: string; label: string; items: NavItem[] }
type NavCategory = { label: string; sections: NavSection[] }

const NAV: NavCategory[] = [
  {
    label: 'Acquisition',
    sections: [
      {
        id: 'overview',
        label: 'Overview',
        items: [
          { label: 'Command Center', href: '/acquisition', icon: TrendingUp    },
          { label: 'Pipeline',       href: '/pipeline',     icon: KanbanSquare },
        ],
      },
      {
        id: 'cold-calling',
        label: 'Cold Calling',
        items: [
          { label: 'Dashboard',  href: '/dashboard', icon: LayoutDashboard },
          { label: 'EOD Reports', href: '/eod',       icon: ClipboardList  },
          { label: 'Resources',  href: '/resources',  icon: BookOpen       },
        ],
      },
      {
        id: 'cold-email',
        label: 'Cold Email',
        items: [
          { label: 'Dashboard', href: '/cold-email',          icon: LayoutDashboard },
          { label: 'Pipeline',  href: '/cold-email/pipeline', icon: KanbanSquare    },
          { label: 'Replies',   href: '/cold-email/replies',  icon: Inbox           },
          { label: 'Leads',     href: '/cold-email/leads',    icon: Users           },
        ],
      },
      {
        id: 'linkedin',
        label: 'LinkedIn',
        items: [
          { label: 'Dashboard',      href: '/linkedin',               icon: LayoutDashboard },
          { label: 'Conversations',  href: '/linkedin/conversations', icon: MessageSquare   },
        ],
      },
      {
        id: 'sales',
        label: 'Sales',
        items: [
          { label: 'Sales Calls', href: '/sales',          icon: PhoneCall },
          { label: 'Insights',    href: '/sales/insights', icon: TrendingUp },
        ],
      },
      {
        id: 'gov-contracts',
        label: 'Gov Contracts',
        items: [
          { label: 'Dashboard',    href: '/gov-contracts',      icon: LayoutDashboard },
          { label: 'Bid Manager',  href: '/gov-contracts/bids', icon: FileText        },
        ],
      },
      {
        id: 'upwork',
        label: 'Upwork',
        items: [
          { label: 'Opportunities', href: '/upwork', icon: Globe },
        ],
      },
    ],
  },
  {
    label: 'Fulfilment',
    sections: [
      {
        id: 'tasks',
        label: 'Tasks',
        items: [
          { label: 'Board',   href: '/tasks',         icon: KanbanSquare },
          { label: 'List',    href: '/tasks/list',    icon: ClipboardList },
          { label: 'Archive', href: '/tasks/archive', icon: Archive       },
        ],
      },
      {
        id: 'meetings',
        label: 'Meetings',
        items: [
          { label: 'Upcoming', href: '/meetings',      icon: CalendarDays },
          { label: 'Past',     href: '/meetings/past', icon: Archive      },
        ],
      },
      {
        id: 'onboarding',
        label: 'Onboarding',
        items: [
          { label: 'Pipeline', href: '/onboarding', icon: Rocket },
        ],
      },
      {
        id: 'accounts',
        label: 'Accounts',
        items: [
          { label: 'Clients',   href: '/accounts',             icon: Briefcase      },
          { label: 'Comms',     href: '/accounts/comms',       icon: MessageSquare  },
          { label: 'Approvals', href: '/accounts/approvals',   icon: CheckSquare    },
          { label: 'Issues',    href: '/accounts/issues',      icon: AlertTriangle  },
        ],
      },
    ],
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function itemIsActive(href: string, pathname: string): boolean {
  // Exact match for short paths to avoid /dashboard matching /dashboard/...
  return pathname === href || pathname.startsWith(href + '/')
}

function sectionIsActive(section: NavSection, pathname: string): boolean {
  return section.items.some(item => itemIsActive(item.href, pathname))
}

// ─── Components ──────────────────────────────────────────────────────────────

function CategoryDivider({ label }: { label: string }) {
  return (
    <div className="mt-3 pt-3 border-t border-[#1c2035]">
      <p className="text-[9px] font-bold tracking-[0.15em] text-[#8b8fa8] uppercase px-3 pb-0.5">
        {label}
      </p>
    </div>
  )
}

function CollapsibleSection({
  section,
  defaultOpen,
  pathname,
}: {
  section: NavSection
  defaultOpen: boolean
  pathname: string
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 pt-3 pb-1 text-left group"
      >
        <span className="text-[9px] font-semibold tracking-[0.13em] text-[#3d4060] uppercase group-hover:text-[#636780] transition-colors">
          {section.label}
        </span>
        <ChevronDown
          className={`transition-transform duration-200 text-[#3d4060] group-hover:text-[#636780] ${open ? '' : '-rotate-90'}`}
          style={{ width: 11, height: 11 }}
        />
      </button>

      {open && (
        <div>
          {section.items.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                itemIsActive(href, pathname)
                  ? 'bg-[#181b27] text-[#e4e6f0] font-medium'
                  : 'text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27]'
              }`}
            >
              <Icon className="h-[15px] w-[15px] shrink-0" />
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Nav ─────────────────────────────────────────────────────────────────

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
            pathname === '/overview'
              ? 'bg-[#181b27] text-[#e4e6f0] font-medium'
              : 'text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27]'
          }`}
        >
          <Home className="h-[15px] w-[15px] shrink-0" />
          Overview
        </Link>

        {/* Updates */}
        <Link
          href="/updates"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
            pathname === '/updates'
              ? 'bg-[#181b27] text-[#e4e6f0] font-medium'
              : 'text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27]'
          }`}
        >
          <Sparkles className="h-[15px] w-[15px] shrink-0" />
          Updates
        </Link>

        {/* Categories */}
        {NAV.map(category => (
          <div key={category.label}>
            <CategoryDivider label={category.label} />
            {category.sections.map(section => (
              <CollapsibleSection
                key={section.id}
                section={section}
                pathname={pathname}
                defaultOpen={sectionIsActive(section, pathname)}
              />
            ))}
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
