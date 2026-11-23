import assert from 'node:assert/strict'
import { test } from 'node:test'
import { budgetBand, buildTags, geographyValues, tagsPrompt, tagsSchema, type TagLists } from './review-tags.ts'

const lists: TagLists = {
  client_type: ['Nonprofit', 'Civic / government'],
  sector: ['Transit', 'Youth & family'],
  services: ['Brand strategy', 'Website', 'Campaign'],
  topics: ['recycling'],
  audiences: ['Youth', 'Donors'],
  requirements: ['Bilingual'],
  procurement: ['RFP', 'RFI', 'Public', 'Private'],
}

test('values are kept in the list\'s own spelling, and repeats are dropped', () => {
  const t = buildTags({ client_type: 'nonprofit', sector: 'TRANSIT', services: ['website', 'Website', 'Campaign'], procurement: ['rfp', 'Public'] }, lists)
  assert.equal(t.client_type, 'Nonprofit')
  assert.equal(t.sector, 'Transit')
  assert.deepEqual(t.services, ['Website', 'Campaign'])
  assert.deepEqual(t.procurement, ['RFP', 'Public'])
})

test('anything not in a list is dropped, never stored', () => {
  const t = buildTags({ client_type: 'Unicorn', sector: '', services: ['Magic', 'Website'], audiences: 'Youth', topics: [3, null, 'recycling'] }, lists)
  assert.equal(t.client_type, null)
  assert.equal(t.sector, null)
  assert.deepEqual(t.services, ['Website'])
  assert.deepEqual(t.audiences, [])
  assert.deepEqual(t.topics, ['recycling'])
})

test('suggested values must be new, in a group that allows them, and at most three', () => {
  const t = buildTags(
    {
      suggested_new: [
        { group: 'topics', value: 'wildfire prevention' },
        { group: 'topics', value: 'Recycling' },
        { group: 'topics', value: 'wildfire PREVENTION' },
        { group: 'budget_band', value: 'Huge' },
        { group: 'audiences', value: '  ' },
        { group: 'services', value: 'Drone shows' },
        { group: 'audiences', value: 'Veterans' },
        { group: 'sector', value: 'Airport' },
      ],
    },
    lists,
  )
  assert.deepEqual(t.suggested_new, [
    { group: 'topics', value: 'wildfire prevention' },
    { group: 'services', value: 'Drone shows' },
    { group: 'audiences', value: 'Veterans' },
  ])
})

test('the state is two letters or nothing', () => {
  assert.equal(buildTags({ state: ' ky ' }, lists).state, 'KY')
  assert.equal(buildTags({ state: 'Kentucky' }, lists).state, null)
  assert.equal(buildTags({ state: '' }, lists).state, null)
})

test('garbage in gives empty tags', () => {
  for (const raw of [null, 'x', 42, [], {}]) {
    const t = buildTags(raw, lists)
    assert.equal(t.client_type, null)
    assert.deepEqual(t.services, [])
    assert.deepEqual(t.suggested_new, [])
  }
})

test('budget bands follow the stated amount', () => {
  assert.equal(budgetBand(null, null), 'Not stated')
  assert.equal(budgetBand(40_000, 40_000), 'Under $50K')
  assert.equal(budgetBand(95_000, 125_000), '$100–250K')
  assert.equal(budgetBand(null, 60_000), '$50–100K')
  assert.equal(budgetBand(300_000, null), '$250K+')
  assert.equal(budgetBand(50_000, 50_000), '$50–100K')
})

test('geography says Louisville/KY or out of state, plus the state', () => {
  assert.deepEqual(geographyValues('KY'), ['Louisville/KY', 'KY'])
  assert.deepEqual(geographyValues('MN'), ['Out of state', 'MN'])
  assert.deepEqual(geographyValues(null), [])
})

test('the schema and prompt carry the lists, and an empty list still gives a valid schema', () => {
  const schema = tagsSchema({ ...lists, topics: [] }) as { properties: Record<string, { enum?: string[]; items?: { enum: string[] } }> }
  assert.deepEqual(schema.properties.client_type.enum, ['Nonprofit', 'Civic / government', ''])
  assert.deepEqual(schema.properties.topics.items?.enum, [''])
  assert.match(tagsPrompt(lists), /services: Brand strategy; Website; Campaign/)
  assert.match(tagsPrompt({ ...lists, topics: [] }), /topics: \(none yet\)/)
})

test('an RFP gets at most four services, keeping the first (most important) ones', () => {
  const many = { ...lists, services: ['Website', 'Campaign', 'Brand strategy', 'Training', 'Translation', 'Accessibility'] }
  const t = buildTags({ services: many.services }, many)
  assert.deepEqual(t.services, ['Website', 'Campaign', 'Brand strategy', 'Training'])
})

test('the prompt asks for core work only, not add-ons or requirements', () => {
  assert.match(tagsPrompt(lists), /only the core work/)
  assert.match(tagsPrompt(lists), /never more than 4/)
})
