import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildReview, docPlainText, findPlaceholders, pageLimitOf, pdfPageCount, reviewComments, reviewProblems, reviewSummary } from './proposal-review.ts'
import { cleanRequirements } from './requirements.ts'

const req = cleanRequirements({
  sections: [
    { title: 'Approach', order: 1, must_address: ['timeline'], page_limit: '3 pages', points: '25 of 100' },
    { title: 'Team', order: 2, must_address: [], page_limit: '500 words', points: null },
    { title: 'References', order: 3 },
  ],
  attachments: [{ name: 'W-9' }, { name: 'Cost form' }],
  submission: { format_rules: ['25 page limit overall', 'Submit as PDF'] },
})
const facts = { pageCount: 8, body: 'Hunger Task Force helped. TBD [client name] see [1]', pastClient: 'Hunger Task Force', now: new Date('2026-11-22T12:00:00Z') }

test('page limits come only from "N pages"', () => {
  assert.equal(pageLimitOf('3 pages'), 3)
  assert.equal(pageLimitOf('no more than 25-page limit'), 25)
  assert.equal(pageLimitOf('500 words'), null)
  assert.equal(pageLimitOf(null), null)
})

test('the PDF page count ignores the page tree', () => {
  const pdf = new TextEncoder().encode('/Type /Pages /Kids [] /Type /Page /A /Type/Page /B /Type /Catalog')
  assert.equal(pdfPageCount(pdf), 2)
  assert.equal(pdfPageCount(new TextEncoder().encode('nothing')), null)
})

test('placeholders are found once each and citations are not placeholders', () => {
  assert.deepEqual(findPlaceholders('TBD and TBD, [client name], [1], [2–4], Lorem Ipsum'), ['TBD', '[client name]', 'lorem ipsum'])
})

test('doc text includes table cells', () => {
  const para = (t: string) => ({ paragraph: { elements: [{ textRun: { content: `${t}\n` } }] } })
  const text = docPlainText([para('A'), { table: { tableRows: [{ tableCells: [{ content: [para('B')] }] }] } }])
  assert.equal(text, 'A\nB')
})

test('the answer is matched back to the requirements; gaps are never shown as fine', () => {
  const rv = buildReview(
    {
      sections: [{ required: 1, status: 'complete', missing_items: [], pages: 5, note: '' }, { required: 2, status: 'partial', missing_items: ['bios'], pages: 1, note: '' }, { required: 9, status: 'complete' }],
      attachments: [{ attachment: 1, status: 'included' }],
      format: [{ rule: 1, status: 'ok', note: '' }],
      other: ['A', '', 'B'],
    },
    req,
    facts,
  )
  assert.deepEqual(rv.sections.map((s) => [s.title, s.status, s.overLimit]), [['Approach', 'complete', true], ['Team', 'partial', false], ['References', 'partial', false]])
  assert.equal(rv.sections[2].note, 'The check did not cover this section.')
  assert.deepEqual(rv.attachments.map((a) => a.status), ['included', 'not_found'])
  assert.deepEqual(rv.format.map((f) => f.status), ['ok', 'cannot_check'])
  assert.deepEqual(rv.other, ['A', 'B'])
  assert.equal(rv.leftovers.pastClientMentions, 1)
  assert.deepEqual(rv.leftovers.placeholders, ['TBD', '[client name]'])
  assert.equal(rv.checkedAt, '2026-11-22T12:00:00.000Z')
  assert.equal(rv.pagesChecked, true)
})

test('the summary, problems and comments say the same things', () => {
  const rv = buildReview({ sections: [{ required: 1, status: 'complete', pages: 5 }, { required: 2, status: 'missing' }, { required: 3, status: 'complete' }] }, req, facts)
  assert.equal(reviewSummary(rv), '2 of 3 sections complete · 2 attachments not found · 1 over a page limit')
  const problems = reviewProblems(rv)
  assert.equal(problems[0], 'Team: missing')
  assert.ok(problems.includes('Approach: about 5 pages, limit 3'))
  const { top, items } = reviewComments(rv, 'Nov 22')
  assert.match(top, /It never edits this Doc/)
  assert.ok(items.some((i) => i.startsWith('▸ Review · Approach') && i.includes('Points: 25 of 100.')))
  assert.ok(items.some((i) => i.startsWith('▸ Review · Attachments')))
  assert.ok(items.some((i) => i.startsWith('▸ Review · Leftovers')))
})

test('with no structure, sections are not judged', () => {
  const none = cleanRequirements({ sections: [] })
  const rv = buildReview({}, none, { pageCount: null, body: '', pastClient: null })
  assert.equal(rv.structureChecked, false)
  assert.equal(reviewSummary(rv), "The RFP sets no structure, so sections weren't checked")
})

test('a Doc too large to export is checked from its text, and the comment says pages were not checked', () => {
  const rv = buildReview({ sections: [{ required: 1, status: 'complete', pages: 0 }] }, req, { pageCount: null, pagesChecked: false, body: '', pastClient: null })
  assert.equal(rv.pagesChecked, false)
  assert.match(reviewComments(rv, 'Nov 22').top, /page counts and page limits weren't checked/)
})
