import { notFound } from 'next/navigation'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import WelcomePortal from '@/components/onboarding/welcome-portal'

export const dynamic = 'force-dynamic'

// Public, tokenized welcome portal — no auth. Unlocks once the contract is
// signed; before that, clients see a short holding message instead.
export default async function WelcomePage({ params }: { params: { token: string } }) {
  const supabase = createSupabaseAdmin()
  const { data: onboarding } = await supabase
    .from('onboardings')
    .select('*')
    .eq('portal_token', params.token)
    .single()

  if (!onboarding) notFound()

  const isUnlocked = onboarding.status !== 'won' && onboarding.status !== 'contract_sent'

  if (isUnlocked && !onboarding.portal_opened_at) {
    await supabase
      .from('onboardings')
      .update({ portal_opened_at: new Date().toISOString() })
      .eq('id', onboarding.id)
  }

  if (!isUnlocked) {
    const firstName = (onboarding.contact_name ?? onboarding.company_name).split(' ')[0]
    return (
      <div className="min-h-screen bg-[#08090c] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold text-[#e4e6f0] mb-3">Almost there, {firstName}.</h1>
          <p className="text-sm text-[#8b8fa8] leading-relaxed">
            This portal unlocks the moment your contract is signed. Check your email for the
            agreement from SignWell — as soon as it's signed, you'll get a link straight back here.
          </p>
        </div>
      </div>
    )
  }

  const { data: existingForm } = await supabase
    .from('onboarding_forms')
    .select('*')
    .eq('onboarding_id', onboarding.id)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return <WelcomePortal onboarding={onboarding} existingForm={existingForm ?? null} />
}
