import { NextRequest, NextResponse } from 'next/server'
import { fetchLatestUpdates, logUpdate } from '@/lib/updates'
import type { OsUpdateTag } from '@/lib/types'

export const dynamic = 'force-dynamic'

const VALID_TAGS = ['New', 'Fix', 'Building', 'Improved'] as const

// GET /api/updates — latest 20 team updates
export async function GET() {
  const updates = await fetchLatestUpdates(20)
  return NextResponse.json({ updates }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/updates — append a new update
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, description, tag } = body

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }
    if (tag !== undefined && tag !== null && !VALID_TAGS.includes(tag)) {
      return NextResponse.json({ error: `tag must be one of: ${VALID_TAGS.join(', ')}` }, { status: 400 })
    }

    const update = await logUpdate(title, description, (tag ?? undefined) as OsUpdateTag | undefined)
    if (!update) return NextResponse.json({ error: 'Failed to create update' }, { status: 500 })

    return NextResponse.json({ update })
  } catch (err) {
    console.error('[updates/route POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
