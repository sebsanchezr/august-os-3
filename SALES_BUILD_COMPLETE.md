# Sales Calls Build Complete

All phases executed. Here's what's ready:

## Next Steps

### 1. Apply the Supabase migration
```bash
cd cold_call_os
# Apply migration 011_sales_calls.sql to your Supabase project
# Via Supabase dashboard: SQL Editor > paste contents of supabase/migrations/011_sales_calls.sql > Run
```

### 2. Set up the sales analyst agent (optional, on-demand analysis for now)
The agent (agents/07_sales_call_analyst/sales_call_analyst.py) will analyze calls automatically if you want to schedule it. For now, you can:
- Log sales calls with transcripts in the OS
- Manually request analysis via the "Run Analysis" button in the call detail slide-over
- Or set up the agent to run hourly (see agents/07_sales_call_analyst/README.md)

If you want the agent now:
```bash
export ANTHROPIC_API_KEY="..."
export SUPABASE_URL="..."
export SUPABASE_SERVICE_KEY="..."
export DISCORD_SALES_WEBHOOK_URL="..."  # optional, for Discord summaries

python3 agents/07_sales_call_analyst/sales_call_analyst.py
```

### 3. Test the flow
1. Go to [/sales](/sales) in the OS
2. Click "Log Sales Call"
3. Fill in the form:
   - Select Kuick Cars as the prospect (it's in the pipeline now)
   - Set call type to "discovery"
   - Paste a transcript from a sales call
   - Click "Save Call"
4. Once saved, click the call row to open the detail view
5. Click "Run Analysis" button (if transcript is present)
6. Watch the analysis appear (check browser console for any errors)

### 4. View insights
Once you have a few analyzed calls:
- Go to [/sales/insights](/sales/insights)
- See your average scores by dimension, common objections, SOP gaps

### 5. Check the SOP
- [/sop/sales-call](/sop/sales-call) - the two-call framework and rubric
- [/sop/sales-deck](/sop/sales-deck) - MVP deck guidelines

## What was built

### Database (Migration 011)
- `sales_calls` table with full lifecycle fields
- Linked to `pipeline_deals` (prospects, not clients)
- Stores transcript, analysis JSON, outcome

### API Routes (app/api/sales-calls/)
- GET /api/sales-calls - list all calls with filters
- POST /api/sales-calls - create a new call
- GET /api/sales-calls/[id] - view one call
- PATCH /api/sales-calls/[id] - update a call
- DELETE /api/sales-calls/[id] - delete a call
- POST /api/sales-calls/[id]/request-analysis - trigger analysis

### UI Pages & Components
- [/sales](/sales) - table of all sales calls, log drawer, detail slide-over
- [/sales/insights](/sales/insights) - KPIs, dimension performance chart, objection analysis, SOP gaps
- /sop/sales-call - framework (before/during/after, objection handling, rubric)
- /sop/sales-deck - MVP deck slide structure and guidelines
- Nav updated with Sales section under Acquisition

### Analysis Engine
- agents/07_sales_call_analyst/ - Python agent that:
  - Polls for calls with transcripts
  - Scores against rubric dimensions
  - Extracts strengths, improvements, objections, SOP gaps
  - Writes analysis JSON back to Supabase
  - Posts summary to Discord

### Types & Utilities
- lib/types.ts - SalesCall, SalesCallAnalysis, etc.
- lib/sales-rubric.ts - dimension definitions and framework text
- lib/sales-calls-client.ts - fetchers and mutations

## Design decisions made

1. **Sales calls attach to pipeline_deals, not clients** - a prospect becomes a client only after they win
2. **Transcript first, video optional** - recordings are just links, transcripts are the artifact we learn from
3. **Four call types** - discovery, pitch, followup, onboarding (each has its own rubric)
4. **Analysis via Python agent** - keeps Claude out of the web app, matches agent 06 architecture
5. **Schedule-driven transcript routing** - sales call transcripts land in the same Drive folder as client meetings; matching by scheduled_at time prevents misfiles

## Testing

The build is ready to test. You should:
1. Add a sale call for Kuick Cars tomorrow at 2pm (already in pipeline)
2. After the call, paste the transcript
3. Watch the analysis run
4. Check the insights page to see what's working

## Known limitations (v1)

- Analysis is on-demand or via scheduled agent; not instant
- No auto-improvement of SOP based on gaps (manual review only)
- Transcript routing assumes you book calls in OS first (the claim ticket)
- No video/audio transcription; relies on Google Meet's transcript export
