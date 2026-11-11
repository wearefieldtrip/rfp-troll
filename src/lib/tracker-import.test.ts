import assert from 'node:assert/strict'
import { test } from 'node:test'
import { geographyTags, importKey, parseRow, planActions, readOutcome, readStates, selectRows, summarize, type SheetRow } from './tracker-import.ts'

const row = (cells: Record<string, string>, linkTitle = 'Sample + Fieldtrip', rowNumber = 2): SheetRow => ({
  row: rowNumber,
  cells: {
    Project: 'Sample',
    'Project Type': 'Brand',
    'Client Type 1': 'Nonprofit',
    'Client Type 2': 'Foundation',
    'Submission Year': '2025',
    State: 'KY',
    'Document Type': 'RFP',
    'Louisville/KY focus': 'FALSE',
    'Did We Win?': 'FALSE',
    Response: 'Not Selected',
    ...cells,
  },
  linkTitle,
  linkUrl: 'https://docs.google.com/document/d/abc/edit',
})

test('every response in the tracker becomes the right outcome, stage and reason', () => {
  const cases: [string, string, string, string | null, string | null, string | null][] = [
    // did we win, response, outcome, stage, reason, note
    ['TRUE', '', 'won', null, null, null],
    ['TRUE', 'Won, but never took off', 'won', null, null, 'Won, but never took off'],
    ['Qualified', 'Qualified Vendor, but not given a project', 'qualified', 'submitted', null, 'Qualified Vendor, but not given a project'],
    ['FALSE', 'Not Selected', 'lost', 'submitted', null, null],
    ['FALSE', 'Not Selected; Local Agency', 'lost', 'submitted', 'Local agency', null],
    ['FALSE', 'Not Selected; No Clarification', 'lost', 'submitted', 'No clarification', null],
    ['FALSE', 'Not Selected (Process took months)', 'lost', 'submitted', null, 'The process took months'],
    ['FALSE', 'No Response', 'no_response', 'submitted', null, null],
    ['FALSE', 'Finalist; Pitched; Lost', 'lost', 'pitched', null, null],
    ['FALSE', 'Finalist; Pitched; Second Place', 'lost', 'pitched', null, 'Second place'],
    ['FALSE', 'Finalist; No Pitch', 'lost', 'finalist', null, null],
    ['FALSE', 'Finalist; No Ptich', 'lost', 'finalist', null, null],
    ['FALSE', 'N/A', 'unknown', null, null, null],
    ['FALSE', '', 'lost', 'submitted', null, null],
    ['maybe', '', 'unknown', null, null, null],
  ]
  for (const [win, response, outcome, stage, reason, note] of cases) {
    assert.deepEqual(readOutcome(win, response), { outcome, stage, reason, note }, `${win} / ${response}`)
  }
})

test('only a win is Closed · Won; everything else is Closed · Lost', () => {
  assert.equal(parseRow(row({ 'Did We Win?': 'TRUE', Response: '' }))?.status, 'closed_won')
  for (const [win, response] of [['FALSE', 'No Response'], ['Qualified', 'x'], ['FALSE', 'N/A']]) {
    assert.equal(parseRow(row({ 'Did We Win?': win, Response: response }))?.status, 'closed_lost')
  }
})

test('client type fixes the tracker\'s spelling, and philanthropy is nonprofit', () => {
  const type = (v: string) => parseRow(row({ 'Client Type 1': v }))?.tags.client_type
  assert.deepEqual(type('Noprofit'), ['Nonprofit'])
  assert.deepEqual(type('Philanthropy'), ['Nonprofit'])
  assert.deepEqual(type('Civic'), ['Civic / government'])
  assert.deepEqual(type('Education'), ['Education'])
})

test('sectors map to the list; the rest become issues for review', () => {
  const sector = (v: string) => parseRow(row({ 'Client Type 2': v }))
  for (const [from, to] of [['K-12', 'K-12'], ['K12', 'K-12'], ['Solid Waste', 'Environmental / solid waste'], ['Environmental', 'Environmental / solid waste'], ['Parks', 'Parks & rec'], ['Healthcare', 'Health'], ['Higher Ed', 'Higher ed'], ['State', 'State agency']]) {
    assert.deepEqual(sector(from)?.tags.sector, [to], from)
  }
  for (const from of ['Childcare', 'Legal', 'IDD', 'Food', 'Support', 'MPO', 'Airport', 'Noprofit', '']) {
    const parsed = sector(from)
    assert.deepEqual(parsed?.tags.sector, [], from)
    assert.ok(parsed?.issues.some((i) => i.field === 'Client Type 2'), from)
  }
})

test('project types become services', () => {
  const services = (v: string) => parseRow(row({ 'Project Type': v }))?.tags.services
  assert.deepEqual(services('Brand'), ['Brand strategy', 'Visual identity'])
  assert.deepEqual(services('Brand + Website'), ['Brand strategy', 'Visual identity', 'Website'])
  assert.deepEqual(services('Brand + Marketing'), ['Brand strategy', 'Visual identity', 'Campaign'])
  assert.deepEqual(services('Brand - Survey'), ['Brand strategy', 'Research & discovery'])
  assert.deepEqual(services('Campaign - Creative'), ['Campaign'])
  assert.deepEqual(services('Marketing/AOR'), ['Agency of record'])
  assert.deepEqual(services('Report'), ['Print & reports'])
  assert.deepEqual(services('Signage'), ['Signage & wayfinding'])
  assert.equal(parseRow(row({ 'Project Type': 'Mystery' }))?.issues.length, 1)
})

test('document type becomes procurement', () => {
  assert.deepEqual(parseRow(row({ 'Document Type': 'RFQ' }))?.tags.procurement, ['RFQ'])
  assert.equal(parseRow(row({ 'Document Type': 'RFX' }))?.issues.length, 1)
})

test('states: two letters, "KY / IN" is two, anything else is an issue', () => {
  assert.deepEqual(readStates('KY / IN'), { states: ['KY', 'IN'], bad: [] })
  assert.deepEqual(readStates('mn'), { states: ['MN'], bad: [] })
  assert.deepEqual(readStates('Minnesota'), { states: [], bad: ['Minnesota'] })
})

test('geography: Louisville focus, out of state, or just the state for a Kentucky RFP', () => {
  assert.deepEqual(geographyTags(['KY'], true), ['Louisville/KY', 'KY'])
  assert.deepEqual(geographyTags(['KY'], false), ['KY'])
  assert.deepEqual(geographyTags(['MN'], false), ['Out of state', 'MN'])
  assert.deepEqual(geographyTags(['KY', 'IN'], false), ['KY', 'IN'])
  assert.deepEqual(geographyTags([], false), [])
})

test('a whole row, like the first one in the tracker', () => {
  const parsed = parseRow(
    row(
      {
        Project: 'VentureWell',
        'Project Type': 'Brand + Website',
        'Client Type 1': 'Nonprofit',
        'Client Type 2': 'Foundation',
        'Submission Year': '2026',
        State: 'MA',
        'Document Type': 'RFP',
        'Did We Win?': 'FALSE',
        Response: 'Not Selected; No Clarification',
        'Case Studies Used': 'SWHR\nPMC\nGirls with Guts',
        Capabilities: 'TRUE',
        'About Fieldtrip': 'FALSE',
        'Prepared By': 'Ryan',
      },
      'VentureWell + Fieldtrip: Brand Refresh and Website Build RFP - MASTER',
    ),
  )
  assert.ok(parsed)
  assert.equal(parsed.client, 'VentureWell')
  assert.equal(parsed.title, 'VentureWell + Fieldtrip: Brand Refresh and Website Build RFP - MASTER')
  assert.equal(parsed.year, 2026)
  assert.equal(parsed.outcome, 'lost')
  assert.equal(parsed.reason, 'No clarification')
  assert.deepEqual(parsed.tags.geography, ['Out of state', 'MA'])
  assert.deepEqual(parsed.issues, [])
  const data = parsed.data as { sections: Record<string, boolean>; case_studies: string[]; link_url: string }
  assert.deepEqual(data.case_studies, ['SWHR', 'PMC', 'Girls with Guts'])
  assert.equal(data.sections.Capabilities, true)
  assert.equal(data.sections['About Fieldtrip'], false)
  assert.equal('Louisville/KY focus' in data.sections, false)
  assert.equal(data.link_url, 'https://docs.google.com/document/d/abc/edit')
})

test('a blank row is skipped', () => {
  assert.equal(parseRow(row({ Project: '  ' })), null)
})

test('the key ignores case, spacing and punctuation, so a second run finds the same RFP', () => {
  assert.equal(importKey('Home of the Innocents', 'Home of the Innocents + Fieldtrip', 2026), importKey(' home  of the INNOCENTS ', 'Home of the Innocents + Fieldtrip!', 2026))
  assert.notEqual(importKey('A', 'B', 2025), importKey('A', 'B', 2026))
  // The tracker's two Louisville Parks and Recreation rows have different proposal titles, so they stay two RFPs.
  assert.notEqual(importKey('Louisville Parks and Recreation', 'RFI #240335 LMG Parks and Recreation + Fieldtrip', 2024), importKey('Louisville Parks and Recreation', 'Louisville Parks and Recreation RFP # 250167 Response from Fieldtrip', 2025))
})

test('a second run updates what it made and never touches a reviewed RFP', () => {
  const a = parseRow(row({ Project: 'A' }, 'A + Fieldtrip', 2))!
  const b = parseRow(row({ Project: 'B' }, 'B + Fieldtrip', 3))!
  const c = parseRow(row({ Project: 'C' }, 'C + Fieldtrip', 4))!
  const plan = planActions([a, b, c], new Map([[a.key, { reviewed: false }], [b.key, { reviewed: true }]]))
  assert.deepEqual(plan.map((p) => p.action), ['update', 'skip_reviewed', 'create'])
})

test('the same key twice in one run is one RFP', () => {
  const a = parseRow(row({ Project: 'A' }, 'A + Fieldtrip', 2))!
  const again = parseRow(row({ Project: 'A' }, 'A + Fieldtrip', 9))!
  assert.deepEqual(planActions([a, again], new Map()).map((p) => p.action), ['create', 'update'])
})

test('rows can be picked by sheet row number', () => {
  const rows = [2, 3, 4, 5].map((n) => ({ row: n }))
  assert.deepEqual(selectRows(rows, 3, 4).map((r) => r.row), [3, 4])
  assert.deepEqual(selectRows(rows, undefined, 3).map((r) => r.row), [2, 3])
  assert.equal(selectRows(rows).length, 4)
})

test('the summary counts actions, outcomes and the values that need review', () => {
  const rows = [
    parseRow(row({ 'Client Type 2': 'Airport' }, 'A + F', 2))!,
    parseRow(row({ 'Client Type 2': 'Airport', 'Did We Win?': 'TRUE', Response: '' }, 'B + F', 3))!,
    parseRow(row({}, 'C + F', 4))!,
  ]
  const s = summarize(planActions(rows, new Map()))
  assert.equal(s.rows, 3)
  assert.deepEqual(s.actions, { create: 3 })
  assert.deepEqual(s.outcomes, { lost: 2, won: 1 })
  assert.equal(s.rowsWithIssues, 2)
  assert.deepEqual(s.unmapped, [{ what: 'Client Type 2: Airport', rows: 2 }])
})
