import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cleanMapping, countMentions, findReplacements, orderMoves, parseSections, planEdits, replacementRequests, sectionFlags, type El, type RequiredLite } from './proposal-plan.ts'

let cursor = 1
const para = (text: string, style = 'NORMAL_TEXT', extra: object[] = []): El => {
  const startIndex = cursor
  cursor += text.length + 1
  return { startIndex, endIndex: cursor, paragraph: { elements: [{ startIndex, endIndex: cursor, textRun: { content: `${text}\n` } }, ...extra], paragraphStyle: { namedStyleType: style } } }
}
const h = (t: string, level = 1) => para(t, `HEADING_${level}`)

// Cover, then About, Team (with a sub-heading), Pricing, Approach.
const doc = (): El[] => {
  cursor = 1
  return [
    para('Hunger Task Force Proposal', 'TITLE'),
    h('About Us'),
    para('We served 12,000 families for Hunger Task Force.'),
    h('Our Team'),
    h('Bios', 2),
    para('Two people.', 'NORMAL_TEXT', [{ inlineObjectElement: {} }]),
    h('Pricing'),
    para('$50,000'),
    h('Approach'),
    para('We listen.'),
  ]
}
const required: RequiredLite[] = [
  { title: 'Approach', mustAddress: [], pageLimit: null, points: null },
  { title: 'Staff', mustAddress: [], pageLimit: null, points: null },
  { title: 'Cost Proposal', mustAddress: [], pageLimit: null, points: null },
  { title: 'References', mustAddress: [], pageLimit: null, points: null },
]

test('sections are the top-level headings; sub-headings stay inside', () => {
  const p = parseSections(doc())
  assert.deepEqual(p.sections.map((s) => s.title), ['About Us', 'Our Team', 'Pricing', 'Approach'])
  assert.equal(p.level, 1)
  assert.match(p.sections[1].body, /Bios/)
  assert.equal(p.sections[1].images, 1)
  assert.equal(p.sections[0].start, p.coverEnd)
  assert.equal(p.sections[3].end, p.docEnd - 1)
})

test('a doc whose top heading is level 2 uses that level', () => {
  cursor = 1
  const p = parseSections([h('A', 2), para('x'), h('B', 3), h('C', 2)])
  assert.deepEqual(p.sections.map((s) => s.title), ['A', 'C'])
})

test('a mapping keeps only valid, one-to-one matches', () => {
  const m = cleanMapping({ matches: [{ section: 1, required: 1 }, { section: 1, required: 2 }, { section: 2, required: 1 }, { section: 9, required: 1 }, { section: 3, required: 2 }], pricing: [3, 99, 'x'] }, 4, 4)
  assert.deepEqual([...m.matches], [[0, 0], [2, 1]])
  assert.deepEqual([...m.pricing], [2])
  assert.equal(cleanMapping('nope', 4, 4).matches.size, 0)
})

test('unmatched sections are deleted, matched ones renamed, pricing cleared, missing ones added', () => {
  const parsed = parseSections(doc())
  // About Us unmatched; Our Team → Staff; Pricing → Cost Proposal; Approach → Approach; References has no match.
  const mapping = cleanMapping({ matches: [{ section: 2, required: 2 }, { section: 3, required: 3 }, { section: 4, required: 1 }], pricing: [3] }, 4, 4)
  const plan = planEdits(parsed, required, mapping)
  assert.deepEqual(plan.removed.map((s) => s.title), ['About Us'])
  assert.deepEqual(plan.kept.map((k) => [k.section.title, required[k.required].title, k.pricingCleared]), [['Our Team', 'Staff', false], ['Pricing', 'Cost Proposal', true], ['Approach', 'Approach', false]])
  assert.deepEqual(plan.added, [{ required: 3, before: null }])

  // Edits never touch an earlier position first: the positions of what follows must stay valid.
  const starts = plan.requests.map((r) => {
    const q = r as Record<string, { location?: { index: number }; range?: { startIndex: number } }>
    return q.insertText?.location?.index ?? q.deleteContentRange?.range?.startIndex ?? q.updateParagraphStyle?.range?.startIndex ?? 0
  })
  assert.ok(plan.requests.some((r) => 'updateParagraphStyle' in r))
  // The first request is the heading added at the end of the doc.
  assert.ok('insertText' in plan.requests[0])
  assert.equal(starts[0], parsed.docEnd - 1)
})

test('a section already named right is not renamed', () => {
  const parsed = parseSections(doc())
  const plan = planEdits(parsed, required, cleanMapping({ matches: [{ section: 4, required: 1 }] }, 4, 4))
  // One insertion with the three added headings, and no rename.
  const inserts = plan.requests.filter((r) => 'insertText' in r) as { insertText: { text: string } }[]
  assert.equal(inserts.length, 1)
  assert.equal(inserts[0].insertText.text, '\nStaff\nCost Proposal\nReferences')
})

test('out-of-order sections are listed as moves; sections in order need none', () => {
  const parsed = parseSections(doc())
  const inOrder = planEdits(parsed, required.slice(0, 1), cleanMapping({ matches: [{ section: 4, required: 1 }] }, 4, 1))
  assert.deepEqual(orderMoves(inOrder, required.slice(0, 1)), [])
  // Approach (RFP 1st) sits last in the doc, after Team and Pricing: those two should come after it.
  const swapped = planEdits(parsed, required.slice(0, 3), cleanMapping({ matches: [{ section: 2, required: 2 }, { section: 3, required: 3 }, { section: 4, required: 1 }] }, 4, 3))
  const moves = orderMoves(swapped, required.slice(0, 3))
  assert.equal(moves.length, 1)
  assert.equal(moves[0].title, 'Approach')
})

test('mentions, figures and images are flagged; names too short to be safe are not', () => {
  const section = { body: 'We helped Hunger Task Force. hunger task force grew 40%.', images: 2 }
  assert.deepEqual(sectionFlags(section, 'Hunger Task Force'), ['mentions Hunger Task Force 2 times', 'contains figures to verify', '2 images to check'])
  assert.deepEqual(sectionFlags({ body: 'We listen.', images: 0 }, 'Hunger Task Force'), [])
  assert.equal(countMentions('a UK b', 'UK'), 0)
})

test('the past client and title are replaced on the cover only, highest position first', () => {
  const content = doc()
  const parsed = parseSections(content)
  const found = findReplacements(content, [{ from: 'Hunger Task Force', to: 'Riverbend' }], parsed.coverEnd)
  assert.equal(found.length, 1)
  assert.equal(found[0].text, 'Riverbend')
  // The mention in the About section is past the cover, so it is flagged, not replaced.
  assert.equal(findReplacements(content, [{ from: 'Hunger Task Force', to: 'Riverbend' }]).length, 2)
  const requests = replacementRequests(findReplacements(content, [{ from: 'Hunger Task Force', to: 'Riverbend' }]), 'kix.h1')
  assert.deepEqual(requests.map((r) => Object.keys(r)[0]), ['insertText', 'deleteContentRange', 'insertText', 'deleteContentRange'])
  assert.equal((requests[0] as { insertText: { location: { segmentId: string } } }).insertText.location.segmentId, 'kix.h1')
  assert.deepEqual(findReplacements(content, [{ from: 'Hunger Task Force', to: null }]), [])
})
