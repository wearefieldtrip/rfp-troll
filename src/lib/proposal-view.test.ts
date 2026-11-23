import assert from 'node:assert/strict'
import { test } from 'node:test'
import { baseLabel, draftSummaryLine } from './proposal-view.ts'

test('the summary says what the build did and what is left to check', () => {
  assert.equal(draftSummaryLine({ kept: 5, added: 2, removed: 4, checks: [{}, {}, {}], moves: [] }), 'Kept 5 sections, added 2, removed 4 · 3 sections to check')
  assert.equal(draftSummaryLine({ kept: 1, added: 0, removed: 0, checks: [], moves: ['x'] }), 'Kept 1 section, added 0, removed 0 · 1 move to make')
  assert.equal(draftSummaryLine(null), null)
  assert.equal(draftSummaryLine({}), null)
})

test('a base proposal reads as client, year and outcome', () => {
  assert.equal(baseLabel('Hunger Task Force', 'T', 2025, 'won'), 'Hunger Task Force proposal (2025, won)')
  assert.equal(baseLabel(null, 'Food RFP', 2024, 'no_response'), 'Food RFP proposal (2024, no response)')
  assert.equal(baseLabel('X', 'T', 2024, null), 'X proposal (2024)')
})
