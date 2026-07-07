import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { notifyMinutesApproved } from '@/lib/discord-notify'

// POST /api/meetings/[id]/send-minutes
// Emails the approved minutes to attendees via Resend, sets minutes_sent_at,
// logs an outbound client_comms_log row.
// Refuses if the linked followup report is not approved.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { body = {} }

  const { data: meeting, error: meetErr } = await supabase
    .from('client_meetings')
    .select('*, clients(id, name, am_profile_id), followup_report:client_reports!client_meetings_followup_report_id_fkey(id, status, client_message)')
    .eq('id', id)
    .single()

  if (meetErr || !meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
  if (!meeting.minutes_md) return NextResponse.json({ error: 'No minutes drafted yet' }, { status: 422 })
  if (meeting.minutes_sent_at) return NextResponse.json({ error: 'Minutes already sent' }, { status: 422 })

  if (meeting.followup_report && meeting.followup_report.status !== 'approved') {
    return NextResponse.json(
      { error: 'Approve the meeting follow-up report before sending minutes' },
      { status: 422 },
    )
  }

  const attendees: string[] = Array.isArray(meeting.attendees)
    ? meeting.attendees.filter((e: string) => !!e)
    : []

  const extraRecipients: string[] = Array.isArray(body.extra_recipients)
    ? (body.extra_recipients as string[])
    : []
  const allRecipients = [...new Set([...attendees, ...extraRecipients])]

  if (allRecipients.length === 0) {
    return NextResponse.json({ error: 'No attendee emails on this meeting' }, { status: 422 })
  }

  const clientName = meeting.clients?.name ?? 'Client'
  const dateStr = new Date(meeting.scheduled_at).toLocaleString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
    timeZone: 'Europe/London',
  })

  const minsMd = meeting.minutes_md as string
  // Convert simple markdown to basic HTML for email
  const htmlBody = minsMd
    .replace(/^### (.+)$/gm, '<h3 style="margin:12px 0 4px">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="margin:16px 0 6px">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="margin:16px 0 8px">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n/g, '<br/>')

  const html = `
    <div style="font-family:system-ui,sans-serif;color:#111;line-height:1.6;max-width:600px">
      <h2 style="margin:0 0 4px">Meeting Notes: ${clientName}</h2>
      <p style="margin:0 0 16px;color:#555">${dateStr}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>
      <div>${htmlBody}</div>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>
      <p style="margin:0;color:#555;font-size:14px">Sent via August Marketing</p>
    </div>
  `

  const RESEND_KEY = process.env.RESEND_API_KEY
  const FROM = process.env.RESEND_FROM_EMAIL || 'August Marketing <team@augustmarketing.co.uk>'

  if (!RESEND_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: allRecipients,
      subject: `Meeting Notes: ${clientName} - ${dateStr}`,
      html,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: `Email failed: ${err}` }, { status: 500 })
  }

  const now = new Date().toISOString()

  // Set minutes_sent_at
  await supabase
    .from('client_meetings')
    .update({ minutes_sent_at: now, updated_at: now })
    .eq('id', id)

  // Log outbound comm
  await supabase.from('client_comms_log').insert({
    client_id:         meeting.client_id,
    direction:         'outbound',
    channel:           'email',
    summary:           `Meeting minutes sent for ${dateStr} call`,
    sentiment:         'neutral',
    flags:             [],
    logged_by:         body.sent_by ?? null,
    occurred_at:       now,
    requires_response: false,
  })

  // Update last_client_contact
  await supabase
    .from('clients')
    .update({ last_client_contact: now, updated_at: now })
    .eq('id', meeting.client_id)

  // Discord notification
  if (meeting.clients) {
    notifyMinutesApproved(meeting.clients, minsMd.slice(0, 300))
  }

  return NextResponse.json({ sent: true, recipients: allRecipients })
}
