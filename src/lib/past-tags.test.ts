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

test('it adds what the tracker does not hold, beside what the tracker set', () => {
  const existing = [tag('r1', 'services', 'Website', 'import', true)]
  const plan = planPastTags(existing, tags({ services: ['Website', 'Translation'], topics: ['recycling'], audiences: ['Youth'] }), values)
  assert.deepEqual(plan.addValueIds, ['services:Translation', 'topics:recycling', 'audiences:Youth'])
  assert.deepEqual(plan.deleteIds, [])
  assert.deepEqual(plan.added, { services: ['Translation'], topics: ['recycling'], audiences: ['Youth'] })
})

test('a re-run replaces only the AI\'s own earlier unconfirmed tags', () => {
  const existing = [
    tag('old-ai', 'topics', 'recycling', 'ai', false),
    tag('tracker', 'services', 'Website', 'import', true),
    tag('ai-confirmed', 'audiences', 'Youth', 'ai', true),
  ]
  const plan = planPastTags(existing, tags({ topics: ['recycling'], audiences: ['Youth'] }), values)
  assert.deepEqual(plan.deleteIds, ['old-ai'])
  assert.deepEqual(plan.addValueIds, ['topics:recycling'])
  // The confirmed Youth tag stays and is not added twice.
  assert.equal(plan.addValueIds.includes('audiences:Youth'), false)
})

test('a group a person set by hand is left exactly as it is', () => {
  const existing = [tag('mine', 'topics', 'recycling', 'person', true), tag('ai', 'services', 'Campaign', 'ai', false)]
  const plan = planPastTags(existing, tags({ topics: ['recycling'], services: ['Website'] }), values)
  assert.deepEqual(plan.addValueIds, ['services:Website'])
  assert.deepEqual(plan.deleteIds, ['ai'])
})

test('a sector is added only when the RFP has none', () => {
  assert.deepEqual(planPastTags([], tags({ sector: 'Transit' }), values).addValueIds, ['sector:Transit'])
  assert.deepEqual(planPastTags([tag('t', 'sector', 'Health', 'import', true)], tags({ sector: 'Transit' }), values).addValueIds, [])
  // An earlier AI guess can be replaced.
  const plan = planPastTags([tag('g', 'sector', 'Health', 'ai', false)], tags({ sector: 'Transit' }), values)
  assert.deepEqual(plan.deleteIds, ['g'])
  assert.deepEqual(plan.addValueIds, ['sector:Transit'])
})

test('values not in the lists are never added', () => {
  const plan = planPastTags([], tags({ services: ['Drone shows'], topics: ['recycling'] }), values)
  assert.deepEqual(plan.addValueIds, ['topics:recycling'])
})

test('the same value twice is added once, and nothing wanted changes nothing', () => {
  assert.deepEqual(planPastTags([], tags({ services: ['Website', 'website'] }), values).addValueIds, ['services:Website'])
  const plan = planPastTags([], tags(), values)
  assert.deepEqual(plan, { deleteIds: [], addValueIds: [], added: {} })
})

test('each group is capped, keeping the first (most important) ones', () => {
  const many = (n: number, p: string) => Array.from({ length: n }, (_, i) => `${p}${i}`)
  const capped = capTags(tags({ services: many(9, 's'), topics: many(5, 't'), audiences: many(6, 'a'), requirements: many(7, 'r'), sector: 'Transit' }))
  assert.equal(capped.services.length, TAG_CAPS.services)
  assert.equal(capped.topics.length, TAG_CAPS.topics)
  assert.equal(capped.audiences.length, TAG_CAPS.audiences)
  assert.equal(capped.requirements.length, TAG_CAPS.requirements)
  assert.deepEqual(capped.services.slice(0, 2), ['s0', 's1'])
  assert.equal(capped.sector, 'Transit')
  assert.deepEqual(capTags(tags({ services: ['Website'] })).services, ['Website'])
})
