'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, ClipboardList, KanbanSquare, BookOpen, LogOut, Zap,
  Home, FileText, Inbox, Users, MessageSquare, TrendingUp,
  CheckSquare, Archive, ChevronDown, Briefcase, AlertTriangle, CalendarDays, PhoneCall,
  Rocket, Globe, Sparkles, Palette, PoundSterling,
} from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { useEffect, useState } from 'react'
import { filterNav } from '@/lib/access'

// ─── Nav structure ────────────────────────────────────────────────────────────

type NavItem = { label: string; href: string }
type NavSection = { id: string; label: string; icon: React.ElementType; items: NavItem[] }
type NavCategory = { label: string; sections: NavSection[] }

const NAV: NavCategory[] = [
  {
    label: 'Fulfilment',
    sections: [
      {
        id: 'fulfilment-dashboard',
        label: 'Overview',
        icon: LayoutDashboard,
        items: [
          { label: 'Dashboard', href: '/fulfilment' },
        ],
      },
      {
        id: 'tasks',
        label: 'Tasks',
        icon: KanbanSquare,
        items: [
          { label: 'Board',   href: '/tasks'         },
          { label: 'List',    href: '/tasks/list'    },
          { label: 'Archive', href: '/tasks/archive' },
        ],
      },
      {
        id: 'meetings',
        label: 'Meetings',
        icon: CalendarDays,
        items: [
          { label: 'Upcoming', href: '/meetings'      },
          { label: 'Past',     href: '/meetings/past' },
        ],
      },
      {
        id: 'creatives',
        label: 'Creatives',
        icon: Palette,
        items: [
          { label: 'Creative Hub', href: '/creatives' },
        ],
      },
      {
        id: 'onboarding',
        label: 'Onboarding',
        icon: Rocket,
        items: [
          { label: 'Pipeline', href: '/onboarding' },
        ],
      },
      {
        id: 'accounts',
        label: 'Accounts',
        icon: Briefcase,
        items: [
          { label: 'Clients',   href: '/accounts'           },
          { label: 'Approvals', href: '/accounts/approvals' },
          { label: 'Issues',    href: '/accounts/issues'    },
        ],
      },
    ],
  },
  {
    label: 'Acquisition',
    sections: [
      {
        id: 'overview',
        label: 'Overview',
        icon: TrendingUp,
        items: [
          { label: 'Command Center', href: '/acquisition' },
          { label: 'Pipeline',       href: '/pipeline'    },
        ],
      },
      {
        id: 'cold-calling',
        label: 'Cold Calling',
        icon: PhoneCall,
        items: [
          { label: 'Dashboard',  href: '/dashboard' },
          { label: 'EOD Reports', href: '/eod'      },
          { label: 'Websites',   href: '/websites'  },
          { label: 'Resources',  href: '/resources' },
        ],
      },
      {
        id: 'cold-email',
        label: 'Cold Email',
        icon: Inbox,
        items: [
          { label: 'Dashboard', href: '/cold-email'          },
          { label: 'Pipeline',  href: '/cold-email/pipeline' },
          { label: 'Replies',   href: '/cold-email/replies'  },
          { label: 'Leads',     href: '/cold-email/leads'    },
        ],
      },
      {
        id: 'paid-ads-acq',
        label: 'Paid Ads',
        icon: Zap,
        items: [
          { label: 'Dashboard', href: '/paid-ads'          },
          { label: 'Orders',    href: '/paid-ads/orders'   },
          { label: 'Pipeline',  href: '/paid-ads/pipeline' },
        ],
      },
      {
        id: 'linkedin',
        label: 'LinkedIn',
        icon: MessageSquare,
        items: [
          { label: 'Dashboard',      href: '/linkedin'               },
          { label: 'Conversations',  href: '/linkedin/conversations' },
        ],
      },
      {
        id: 'sales',
        label: 'Sales',
        icon: TrendingUp,
        items: [
          { label: 'Sales Calls', href: '/sales'          },
          { label: 'Insights',    href: '/sales/insights' },
        ],
      },
      {
        id: 'gov-contracts',
        label: 'Gov Contracts',
        icon: FileText,
        items: [
          { label: 'Gov Contracts', href: '/gov-contracts' },
        ],
      },
      {
        id: 'upwork',
        label: 'Upwork',
        icon: Globe,
        items: [
          { label: 'Opportunities', href: '/upwork' },
        ],
      },
    ],
  },
  {
    label: 'Agency',
    sections: [
      {
        id: 'finance',
        label: 'Finance',
        icon: PoundSterling,
        items: [
          { label: 'P&L', href: '/finance' },
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
        <span className="flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.13em] text-[#3d4060] uppercase group-hover:text-[#636780] transition-colors">
          <section.icon style={{ width: 11, height: 11 }} className="shrink-0" />
          {section.label}
        </span>
        <ChevronDown
          className={`transition-transform duration-200 text-[#3d4060] group-hover:text-[#636780] ${open ? '' : '-rotate-90'}`}
          style={{ width: 11, height: 11 }}
        />
      </button>

      {open && (
        <div>
          {section.items.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 pl-[26px] pr-3 py-2 rounded-lg text-sm transition-colors ${
                itemIsActive(href, pathname)
                  ? 'bg-[#181b27] text-[#e4e6f0] font-medium'
                  : 'text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27]'
              }`}
            >
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

        {/* Team — visible to every login */}
        <Link
          href="/team"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
            itemIsActive('/team', pathname)
              ? 'bg-[#181b27] text-[#e4e6f0] font-medium'
              : 'text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27]'
          }`}
        >
          <Users className="h-[15px] w-[15px] shrink-0" />
          Team
        </Link>

        {/* Categories */}
        {filterNav(NAV, userEmail).map(category => (
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
