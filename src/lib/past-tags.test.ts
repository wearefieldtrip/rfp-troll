import assert from 'node:assert/strict'
import { test } from 'node:test'
import { capTags, planPastTags, TAG_CAPS, type ExistingTag, type ValueRef } from './past-tags.ts'
import type { ReviewTags } from './review-tags.ts'

const v = (tag_group: string, value: string): ValueRef => ({ id: `${tag_group}:${value}`, tag_group, value, status: 'approved' })
const values = [v('services', 'Website'), v('services', 'Campaign'), v('services', 'Translation'), v('topics', 'recycling'), v('audiences', 'Youth'), v('requirements', 'Bilingual'), v('sector', 'Transit'), v('sector', 'Health')]
const tag = (id: string, group: string, value: string, source: string, confirmed: boolean): ExistingTag => ({ id, tag_value_id: `${group}:${value}`, tag_group: group, source, confirmed })

const tags = (over: Partial<ReviewTags> = {}): ReviewTags => ({
  client_type: null, sector: null, services: [], topics: [], audiences: [], requirements: [], procurement: [], state: null, suggested_new: [], ...over,
})

test('it adds requirements, and leaves services, topics and audiences to the tracker', () => {
  const existing = [tag('r1', 'services', 'Website', 'import', true)]
  const plan = planPastTags(existing, tags({ services: ['Website', 'Translation'], topics: ['recycling'], audiences: ['Youth'], requirements: ['Bilingual'] }), values)
  assert.deepEqual(plan.addValueIds, ['requirements:Bilingual'])
  assert.deepEqual(plan.deleteIds, [])
  assert.deepEqual(plan.added, { requirements: ['Bilingual'] })
})

test('the unconfirmed services, topics and audiences an earlier version wrote are cleared, never a confirmed one', () => {
  const existing = [
    tag('ai-service', 'services', 'Website', 'ai', false),
    tag('ai-topic', 'topics', 'recycling', 'ai', false),
    tag('ai-audience', 'audiences', 'Youth', 'ai', false),
    tag('tracker-service', 'services', 'Campaign', 'import', true),
    tag('confirmed-audience', 'audiences', 'Donors', 'ai', true),
    tag('mine', 'topics', 'fundraising', 'person', true),
  ]
  const plan = planPastTags(existing, tags(), values)
  // The topics group has a tag a person set, so it is left exactly as it is, earlier AI guess and all.
  assert.deepEqual(plan.deleteIds.sort(), ['ai-audience', 'ai-service'])
})

test('a re-run replaces only the AI\'s own earlier unconfirmed requirements', () => {
  const existing = [tag('old-ai', 'requirements', 'Bilingual', 'ai', false), tag('kept', 'requirements', 'Insurance minimums', 'import', true)]
  const plan = planPastTags(existing, tags({ requirements: ['Bilingual'] }), values)
  assert.deepEqual(plan.deleteIds, ['old-ai'])
  assert.deepEqual(plan.addValueIds, ['requirements:Bilingual'])
})

test('requirements a person set by hand are left exactly as they are', () => {
  const existing = [tag('mine', 'requirements', 'Bilingual', 'person', true)]
  const plan = planPastTags(existing, tags({ requirements: ['Bilingual'] }), values)
  assert.deepEqual(plan, { deleteIds: [], addValueIds: [], added: {} })
})

test('a sector is added only when the RFP has none', () => {
  assert.deepEqual(planPastTags([], tags({ sector: 'Transit' }), values).addValueIds, ['sector:Transit'])
  assert.deepEqual(planPastTags([tag('t', 'sector', 'Health', 'import', true)], tags({ sector: 'Transit' }), values).addValueIds, [])
  // An earlier AI guess can be replaced.
  const plan = planPastTags([tag('g', 'sector', 'Health', 'ai', false)], tags({ sector: 'Transit' }), values)
  assert.deepEqual(plan.deleteIds, ['g'])
  assert.deepEqual(plan.addValueIds, ['sector:Transit'])
})

test('values not in the lists are never added, and the same value twice is added once', () => {
  assert.deepEqual(planPastTags([], tags({ requirements: ['Magic', 'Bilingual', 'bilingual'] }), values).addValueIds, ['requirements:Bilingual'])
  assert.deepEqual(planPastTags([], tags(), values), { deleteIds: [], addValueIds: [], added: {} })
})

test('requirements are capped, keeping the first (most important) ones', () => {
  const many = Array.from({ length: 7 }, (_, i) => `r${i}`)
  const capped = capTags(tags({ requirements: many, sector: 'Transit', services: ['Website'] }))
  assert.equal(capped.requirements.length, TAG_CAPS.requirements)
  assert.deepEqual(capped.requirements.slice(0, 2), ['r0', 'r1'])
  assert.equal(capped.sector, 'Transit')
})
