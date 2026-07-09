// Standalone test for the hygiene rule engine. No test runner is installed in
// this repo, so this compiles as plain TS and is run with node against the
// emitted JS (see the report / scratchpad command). It asserts the engine flags
// EXACTLY the three planted issues in the fixture and nothing else.

import { runHygieneRules } from './rules'
import { FIXTURE_ENTITIES, FIXTURE_CONTEXT } from './fixture'

let failures = 0
function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  PASS  ${msg}`)
  } else {
    failures += 1
    console.log(`  FAIL  ${msg}`)
  }
}

const findings = runHygieneRules(FIXTURE_ENTITIES, FIXTURE_CONTEXT)

console.log('\nFindings produced:')
for (const f of findings) {
  console.log(`  [${f.severity.toUpperCase()}] ${f.rule} :: ${f.entityName} :: ${f.evidence}`)
}
console.log('')

const has = (rule: string, name: string) => findings.some((f) => f.rule === rule && f.entityName === name)

assert(findings.length === 3, `exactly 3 findings (got ${findings.length})`)
assert(has('left_on_zero_purchase', 'Broad Cold'), 'flags the left-on zero-purchase ad set (Broad Cold)')
assert(has('paused_winner', 'Retargeting 30d'), 'flags the paused winner ad set (Retargeting 30d)')
assert(has('frequency_fatigue', 'UGC Testimonial v3'), 'flags the high-frequency ad (UGC Testimonial v3)')

// Nothing should fire on known-clean entities.
assert(!findings.some((f) => f.entityName === 'Lookalike 3%'), 'no false positive on a healthy ad set (Lookalike 3%)')
assert(!findings.some((f) => f.entityName === 'RT Dynamic 1'), 'no false positive on paused loser ads (RT Dynamic 1)')

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}\n`)
if (failures > 0) process.exit(1)
