// Turns new GitHub commits on sebsanchezr/august-os-3 (main) into user-facing
// os_updates rows so the /updates page reflects what actually shipped without
// anyone typing it in by hand. Runs daily via app/api/cron/changelog.
//
// Cursor-based (system_state.changelog_last_commit_at) so reruns only look at
// commits since the last successful pass, and a partial unique index on
// os_updates.commit_sha stops the same commit being logged twice even if the
// cursor ever gets rewound.

import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { logUpdate, getSystemState, setSystemState } from '@/lib/updates'
import type { OsUpdateTag } from '@/lib/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const HAIKU = 'claude-haiku-4-5-20251001'
const STYLE_RULES = 'Never use em-dashes. Keep sentences short and direct. No corporate fluff.'

const GITHUB_OWNER = 'sebsanchezr'
const GITHUB_REPO = 'august-os-3'
const GITHUB_BRANCH = 'main'
const CURSOR_KEY = 'changelog_last_commit_at'
const MAX_COMMITS_PER_RUN = 40

const VALID_TAGS: OsUpdateTag[] = ['New', 'Fix', 'Improved', 'Building']

type GithubCommit = {
  sha: string
  parents?: { sha: string }[]
  commit: {
    message: string
    committer: { date: string }
  }
}

type ChangelogEntry = {
  sha: string
  include: boolean
  tag: string
  title: string
  description: string
}

export type ChangelogResult = {
  fetched: number
  logged: number
  skipped: number
  error?: string
}

function extractText(msg: Anthropic.Message): string {
  const block = msg.content.find(b => b.type === 'text')
  return block && block.type === 'text' ? block.text : ''
}

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim()
}

// Extra safety net on top of the prompt instruction, matching the hard
// no-em-dash rule used everywhere else AI output reaches the OS.
function stripEmDashes(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ', ').trim()
}

function isMerge(c: GithubCommit): boolean {
  return (c.parents?.length ?? 0) > 1
}

function buildPrompt(list: { sha: string; message: string }[]): string {
  return `You are writing the public changelog for August OS, an internal agency dashboard. Below is a list of raw git commits (short sha + first line of the commit message). ${STYLE_RULES}

Rules:
- Only INCLUDE user-facing product changes a team member would actually care about seeing shipped (new features, fixed bugs, visible improvements to the app).
- EXCLUDE chore/ci/build/config/refactor/test/docs/infra-only commits, dependency bumps, and anything with no visible effect on the app. Set include=false for these, but still return an entry for them.
- Map the change to a tag: feat -> New, fix -> Fix, perf or a refactor/style change with a user-visible effect -> Improved, wip/scaffolding -> Building. Use judgment when the commit doesn't use conventional-commit prefixes.
- title: concise, sentence case, 70 characters or less, no leading "feat:"/"fix:" prefixes, no em-dashes (use commas or periods instead).
- description: one plain-English sentence on what changed and why it matters, no em-dashes.
- Return an entry for EVERY input sha, in the same order, even the excluded ones.

Commits (oldest first):
${list.map(c => `${c.sha}: ${c.message}`).join('\n')}

Return ONLY strict JSON in this exact shape, no prose, no markdown fences:
{"entries": [{"sha": "<short sha>", "include": true, "tag": "New", "title": "...", "description": "..."}]}`
}

export async function generateChangelog(): Promise<ChangelogResult> {
  try {
    const cursor = await getSystemState(CURSOR_KEY)
    const since = cursor || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const headers: Record<string, string> = {
      'User-Agent': 'august-os-changelog',
      Accept: 'application/vnd.github+json',
    }
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
    }

    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits?sha=${GITHUB_BRANCH}&since=${encodeURIComponent(since)}&per_page=100`
    const ghRes = await fetch(url, { headers })
    if (!ghRes.ok) {
      const body = await ghRes.text().catch(() => '')
      return { fetched: 0, logged: 0, skipped: 0, error: `GitHub API ${ghRes.status}: ${body.slice(0, 300)}` }
    }

    const commits = (await ghRes.json()) as GithubCommit[]
    if (!Array.isArray(commits) || commits.length === 0) {
      return { fetched: 0, logged: 0, skipped: 0 }
    }

    // Newest commit date across everything fetched, used to advance the
    // cursor no matter what ends up getting logged this run.
    const newestDate = commits.reduce((max, c) => {
      const d = c.commit?.committer?.date
      return d && d > max ? d : max
    }, since)

    // Oldest-first for stable processing order.
    const chronological = [...commits].reverse()
    const nonMerge = chronological.filter(c => !isMerge(c))

    let alreadyLogged = new Set<string>()
    if (nonMerge.length) {
      const supabase = createSupabaseAdmin()
      const { data, error } = await supabase
        .from('os_updates')
        .select('commit_sha')
        .in('commit_sha', nonMerge.map(c => c.sha))

      if (error) {
        console.error('[generateChangelog] os_updates lookup', error)
      } else {
        alreadyLogged = new Set((data ?? []).map(r => r.commit_sha).filter(Boolean) as string[])
      }
    }

    const candidates = nonMerge.filter(c => !alreadyLogged.has(c.sha))

    if (candidates.length === 0) {
      await setSystemState(CURSOR_KEY, newestDate)
      return { fetched: commits.length, logged: 0, skipped: 0 }
    }

    const capped = candidates.slice(0, MAX_COMMITS_PER_RUN)
    const shaMap = new Map(capped.map(c => [c.sha.slice(0, 7), c.sha]))
    const list = capped.map(c => ({
      sha: c.sha.slice(0, 7),
      message: (c.commit.message.split('\n')[0] || '').slice(0, 200),
    }))

    const aiRes = await client.messages.create({
      model: HAIKU,
      max_tokens: 4000,
      messages: [{ role: 'user', content: buildPrompt(list) }],
    })

    let entries: ChangelogEntry[] = []
    try {
      const parsed = JSON.parse(stripFences(extractText(aiRes)))
      entries = Array.isArray(parsed.entries) ? parsed.entries : []
    } catch (e) {
      console.error('[generateChangelog] AI response parse failed', e, extractText(aiRes))
      return { fetched: commits.length, logged: 0, skipped: 0, error: 'Failed to parse AI response' }
    }

    let logged = 0
    let skipped = 0

    for (const entry of entries) {
      if (!entry || entry.include !== true) {
        skipped++
        continue
      }
      const fullSha = shaMap.get(entry.sha)
      const title = (entry.title || '').trim()
      if (!fullSha || !title) {
        skipped++
        continue
      }
      const tag: OsUpdateTag = VALID_TAGS.includes(entry.tag as OsUpdateTag)
        ? (entry.tag as OsUpdateTag)
        : 'New'

      const cleanTitle = stripEmDashes(title).slice(0, 90)
      const cleanDescription = entry.description ? stripEmDashes(entry.description.trim()) : undefined

      const result = await logUpdate(cleanTitle, cleanDescription, tag, fullSha)
      if (result) {
        logged++
      } else {
        skipped++
      }
    }

    await setSystemState(CURSOR_KEY, newestDate)

    return { fetched: commits.length, logged, skipped }
  } catch (err) {
    console.error('[generateChangelog] failed', err)
    return {
      fetched: 0,
      logged: 0,
      skipped: 0,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
