// Single source of truth for pipeline source channels.
// Keep in sync with the CHECK constraint on pipeline_deals.source_channel
// (see supabase/migrations/010_pipeline.sql and 027_pipeline_sources.sql).
// Used by both API route validation and the UI selects, so the list only
// ever needs to change in one place.

import type { SourceChannel } from './types'

export const SOURCE_CHANNELS: { value: SourceChannel; label: string }[] = [
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'cold_email', label: 'Cold Email' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'gov', label: 'Gov' },
  { value: 'referral', label: 'Referral' },
  { value: 'expansion', label: 'Expansion' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'networking', label: 'Networking' },
  { value: 'other', label: 'Other' },
]

export const VALID_CHANNELS: SourceChannel[] = SOURCE_CHANNELS.map((c) => c.value)
