import { fetchLatestUpdates } from '@/lib/updates'
import type { OsUpdateTag } from '@/lib/types'

export const dynamic = 'force-dynamic'

const TAG_STYLES: Record<OsUpdateTag, string> = {
  New:      'bg-green-500/10 text-green-400 border border-green-500/20',
  Fix:      'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  Building: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
  Improved: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  Digest:   'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

export default async function UpdatesPage() {
  const updates = await fetchLatestUpdates(20)

  return (
    <div className="p-6 min-h-screen bg-[#08090c]">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[#e4e6f0]">Updates</h1>
          <p className="text-xs text-[#636780] mt-1">What has shipped and what is being built</p>
        </div>

        {updates.length === 0 ? (
          <div className="flex items-center justify-center h-48 rounded-xl border border-[#1c2035] bg-[#10121a]">
            <span className="text-sm text-[#636780]">No updates yet</span>
          </div>
        ) : (
          <div className="space-y-3">
            {updates.map((u) => (
              <div key={u.id} className="rounded-xl border border-[#1c2035] bg-[#10121a] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {u.tag && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${TAG_STYLES[u.tag]}`}>
                        {u.tag}
                      </span>
                    )}
                    <h2 className="text-sm font-semibold text-[#e4e6f0] leading-snug">{u.title}</h2>
                  </div>
                  <span className="text-[11px] text-[#636780] tabular-nums shrink-0 whitespace-nowrap">
                    {formatDate(u.created_at)}
                  </span>
                </div>
                {u.description && (
                  <p className="text-xs text-[#8b8fa8] leading-relaxed mt-2">{u.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
