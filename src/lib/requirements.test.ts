import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cleanRequirements, requirementsSummary } from './requirements.ts'

test('sections keep the RFP order, lose repeats and empties, and are renumbered', () => {
  const req = cleanRequirements({
    sections: [
      { title: ' Approach ', order: 3, must_address: ['a', 'b'], page_limit: '3 pages', points: '25 of 100', source: 'p. 4' },
      { title: 'Team', order: 2, must_address: [], page_limit: null, points: null, source: null },
      { title: 'team', order: 5 },
      { title: '  ', order: 1 },
    ],
  })
  assert.deepEqual(req.sections.map((s) => [s.title, s.order]), [['Team', 1], ['Approach', 2]])
  assert.equal(req.sections[1].pageLimit, '3 pages')
  assert.equal(req.sections[0].pageLimit, null)
})

test('must-address items are capped at 6 and blanks dropped', () => {
  const req = cleanRequirements({ sections: [{ title: 'X', must_address: ['1', '2', '', '3', '4', '5', '6', '7'] }] })
  assert.equal(req.sections[0].mustAddress.length, 6)
})

test('a due date that is not a date is dropped, and garbage gives an empty list', () => {
  assert.equal(cleanRequirements({ submission: { due: 'soon' } }).submission.due, null)
  assert.equal(cleanRequirements({ submission: { due: '2027-01-15T17:00:00-05:00' } }).submission.due, '2027-01-15T17:00:00-05:00')
  assert.deepEqual(cleanRequirements('nope').sections, [])
})

test('the summary names sections, attachments and a page rule', () => {
  const req = cleanRequirements({
    sections: [{ title: 'A' }],
    attachments: [{ name: 'W-9' }, { name: '' }],
    submission: { format_rules: ['Font 12pt', '25 page limit'] },
  })
  assert.equal(requirementsSummary(req), '1 required section · 1 attachment · 25 page limit')
})
