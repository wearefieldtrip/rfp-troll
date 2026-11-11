import assert from 'node:assert/strict'
import { test } from 'node:test'
import { outcomeStatus, reviewReasons, type ImportedForReview } from './review-imports.ts'

const rfp = (over: Partial<ImportedForReview> = {}): ImportedForReview => ({
  import_issues: [],
  outcome: 'lost',
  proposal_link_status: 'linked',
  import_reviewed: false,
  rfp_tags: [],
  ...over,
})

test('a clean imported RFP has nothing to review', () => {
  assert.deepEqual(reviewReasons(rfp()), [])
})

test('a blank sector and a sector with no match read plainly', () => {
  assert.deepEqual(reviewReasons(rfp({ import_issues: [{ field: 'Client Type 2', value: '', reason: 'blank' }] })), ['No sector'])
  assert.deepEqual(reviewReasons(rfp({ import_issues: [{ field: 'Client Type 2', value: 'Airport', reason: 'no matching sector' }] })), ['sector "Airport" has no match'])
})

test('an unclear outcome is said once', () => {
  const unclear = rfp({ outcome: 'unknown', import_issues: [{ field: 'Did We Win?', value: 'FALSE / N/A', reason: 'outcome not clear' }] })
  assert.deepEqual(reviewReasons(unclear), ['Outcome unclear'])
})

test('proposal link problems are named', () => {
  assert.deepEqual(reviewReasons(rfp({ proposal_link_status: 'no_access' })), ["Proposal can't be opened"])
  assert.deepEqual(reviewReasons(rfp({ proposal_link_status: 'not_a_doc' })), ["Proposal link isn't a Google Doc"])
  assert.deepEqual(reviewReasons(rfp({ proposal_link_status: 'no_link' })), ['No proposal link'])
  assert.deepEqual(reviewReasons(rfp({ proposal_link_status: null })), ['Proposal not linked yet'])
})

test('only unconfirmed AI tags count, and they are counted', () => {
  const tags = [
    { source: 'ai', confirmed: false },
    { source: 'ai', confirmed: false },
    { source: 'ai', confirmed: true },
    { source: 'import', confirmed: true },
    { source: 'person', confirmed: true },
  ]
  assert.deepEqual(reviewReasons(rfp({ rfp_tags: tags })), ['2 AI tags to confirm'])
  assert.deepEqual(reviewReasons(rfp({ rfp_tags: [{ source: 'ai', confirmed: false }] })), ['1 AI tag to confirm'])
})

test('a reviewed RFP has nothing left to review, whatever it holds', () => {
  assert.deepEqual(reviewReasons(rfp({ import_reviewed: true, outcome: 'unknown', proposal_link_status: 'no_access', import_issues: [{ field: 'State', value: '', reason: 'blank' }] })), [])
})

test('other flagged values name the column', () => {
  assert.deepEqual(reviewReasons(rfp({ import_issues: [{ field: 'State', value: 'Minnesota', reason: 'not a two-letter state' }, { field: 'Project Type', value: '', reason: 'blank' }] })), ['state "Minnesota" has no match', 'No project type'])
})

test('only a win is Closed · Won', () => {
  assert.equal(outcomeStatus('won'), 'closed_won')
  for (const o of ['lost', 'no_response', 'qualified', 'unknown']) assert.equal(outcomeStatus(o), 'closed_lost')
})
