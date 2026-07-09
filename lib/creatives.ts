// Creative Hub: types + helpers shared by the /creatives page and its API
// routes. Kept local (not in lib/types.ts) per the Creative Hub build scope.



export type AssetKind = 'drive' | 'figma' | 'brief' | 'asset' | 'inspiration' | 'other'
export type StrategyStatus = 'draft' | 'approved' | 'generating' | 'delivered'

export type CreativeAsset = {
  id: string
  client_id: string
  title: string
  kind: AssetKind
  url: string | null
  notes: string | null
  created_at: string
}

export type CreativeStrategy = {
  id: string
  client_id: string
  week_start: string
  focus: string | null
  strategy_md: string | null
  status: StrategyStatus
  created_at: string
  approved_at: string | null
}

export const ASSET_KINDS: AssetKind[] = ['drive', 'figma', 'brief', 'asset', 'inspiration', 'other']

export type ClientOption = {
  id: string
  name: string
  services: string[] | null
}

export type CreativeAssetWithClient = CreativeAsset & {
  client: { id: string; name: string } | null
}

export type StrategyItem = {
  client: ClientOption
  strategy: CreativeStrategy | null
}

// Monday of the current (or given) week, as YYYY-MM-DD.
export function weekStartOf(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay() // 0 = Sun ... 6 = Sat
  const diffToMonday = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diffToMonday)
  return d.toISOString().slice(0, 10)
}

// Postgres "undefined_table" error code, thrown when a migration hasn't run yet.
export function isMissingTableError(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42P01'
}

export const MIGRATION_MISSING_MESSAGE = 'Run migration 033 to enable the Creative Hub.'

export type ClientContext = {
  name: string
  services: string[] | null
  notes: string | null
  target_roas: number | null
  target_cpa: number | null
}

export type MetricsContext = {
  date: string
  spend: number | null
  revenue: number | null
  roas: number | null
  purchases: number | null
  cpa: number | null
}

export type KnowledgeContext = {
  title: string
  content: string
}
