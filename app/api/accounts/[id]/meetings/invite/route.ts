import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { buildIcs, googleCalendarUrl } from '@/lib/ics'

const VALID_TYPES = ['weekly', 'monthly', 'adhoc'] as const

// POST /api/accounts/[id]/meetings/invite
// Creates a client_meetings row AND emails a calendar invite (.ics) to all
// attendees via Resend if RESEND_API_KEY is configured. Always returns a
// Google Calendar link as a zero-setup fallback.
//
// Body: {
//   scheduled_at: ISO string, duration_minutes?: number, type?: string,
//   agenda?: string, attendees: string[] (emails), organizer_email?: string,
//   organizer_name?: string, title?: string
// }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.scheduled_at) return NextResponse.json({ error: 'scheduled_at is required' }, { status: 400 })

  const type = (body.type as string) || 'weekly'
  if (!(VALID_TYPES as readonly string[]).includes(type)) {
    return NextResponse.json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 })
  }

  const attendees = Array.isArray(body.attendees)
    ? (body.attendees as string[]).map((e) => e.trim()).filter(Boolean)
    : []
  const durationMinutes = Number(body.duration_minutes) || 30
  const startUtc = new Date(body.scheduled_at as string)
  if (isNaN(startUtc.getTime())) {
    return NextResponse.json({ error: 'scheduled_at is not a valid date' }, { status: 400 })
  }

  // Client name for the title
  const { data: client } = await supabase.from('clients').select('name').eq('id', id).single()
  const clientName = client?.name ?? 'Client'

  // Title format: "August x [Client] — Weekly" / "Monthly Deep Dive" / "Ad Hoc"
  const typeLabel: Record<string, string> = {
    weekly:  'Weekly Call',
    monthly: 'Monthly Deep Dive',
    adhoc:   'Ad Hoc Call',
  }
  const title = (body.title as string) || `August x ${clientName} — ${typeLabel[type] ?? type}`

  // Create the meeting row
  const { data: meeting, error: meetErr } = await supabase
    .from('client_meetings')
    .insert({
      client_id:    id,
      type,
      scheduled_at: startUtc.toISOString(),
      agenda:       body.agenda ?? null,
    })
    .select()
    .single()

  if (meetErr || !meeting) return NextResponse.json({ error: meetErr?.message ?? 'Insert failed' }, { status: 500 })

  const organizerEmail = (body.organizer_email as string) || 'team@augustmarketing.co.uk'
  const organizerName = (body.organizer_name as string) || 'August Marketing'
  const description = (body.agenda as string) || `${type} call with ${clientName}.`

  const gcalUrl = googleCalendarUrl({
    title,
    startUtc,
    durationMinutes,
    description,
    attendees,
  })

  // Try to send real invites via Resend
  let emailSent = false
  let emailError: string | null = null
  const RESEND_KEY = process.env.RESEND_API_KEY
  const FROM = process.env.RESEND_FROM_EMAIL || 'August Marketing <team@augustmarketing.co.uk>'

  if (RESEND_KEY && attendees.length > 0) {
    const ics = buildIcs({
      uid: `${meeting.id}@augustos`,
      title,
      description,
      startUtc,
      durationMinutes,
      organizerName,
      organizerEmail,
      attendees: attendees.map((email) => ({ email })),
    })

    const when = startUtc.toLocaleString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
    })

    const html = `
      <div style="font-family:system-ui,sans-serif;color:#111;line-height:1.5">
        <h2 style="margin:0 0 8px">${title}</h2>
        <p style="margin:0 0 4px"><strong>When:</strong> ${when} (UK time)</p>
        ${body.agenda ? `<p style="margin:8px 0"><strong>Agenda:</strong><br/>${String(body.agenda).replace(/\n/g, '<br/>')}</p>` : ''}
        <p style="margin:16px 0 4px;color:#555">A calendar invite is attached. Accept it to add this to your calendar.</p>
      </div>
    `

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM,
          to: attendees,
          subject: `Invitation: ${title} - ${when}`,
          html,
          attachments: [
            {
              filename: 'invite.ics',
              content: Buffer.from(ics).toString('base64'),
              content_type: 'text/calendar; method=REQUEST; name=invite.ics',
            },
          ],
        }),
      })
      if (res.ok) {
        emailSent = true
      } else {
        emailError = `Resend responded ${res.status}`
      }
    } catch (e: unknown) {
      emailError = (e as Error).message
    }
  } else if (!RESEND_KEY) {
    emailError = 'RESEND_API_KEY not configured'
  }

  return NextResponse.json({
    meeting,
    email_sent: emailSent,
    email_error: emailError,
    google_calendar_url: gcalUrl,
  })
}
