import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canRemove, cleanValue, hasValue, isTagGroup, TAG_GROUPS, valuesOf, type TagValue } from './tag-groups.ts'

const v = (tag_group: string, value: string, status = 'approved'): TagValue => ({ id: `${tag_group}-${value}`, tag_group, value, status })

test('there are nine groups with distinct keys', () => {
  assert.equal(TAG_GROUPS.length, 9)
  assert.equal(new Set(TAG_GROUPS.map((g) => g.key)).size, 9)
  assert.ok(isTagGroup('sector'))
  assert.ok(!isTagGroup('nope'))
})

test('one-value groups are client type, sector, budget band and geography', () => {
  assert.deepEqual(TAG_GROUPS.filter((g) => !g.many).map((g) => g.key), ['client_type', 'sector', 'budget_band', 'geography'])
})

test('values are shown by name, only of the group and status asked for', () => {
  const all = [v('sector', 'Transit'), v('sector', 'health'), v('sector', 'K-12'), v('services', 'Website'), v('sector', 'Airport', 'suggested')]
  assert.deepEqual(valuesOf(all, 'sector').map((x) => x.value), ['health', 'K-12', 'Transit'])
  assert.deepEqual(valuesOf(all, 'sector', 'suggested').map((x) => x.value), ['Airport'])
})

test('budget bands keep their order, not alphabetical order', () => {
  const bands = ['Not stated', '$250K+', 'Under $50K', '$100–250K', '$50–100K'].map((x) => v('budget_band', x))
  assert.deepEqual(valuesOf(bands, 'budget_band').map((x) => x.value), ['Under $50K', '$50–100K', '$100–250K', '$250K+', 'Not stated'])
})

test('only unused values, or suggestions, can be removed', () => {
  assert.equal(canRemove({ status: 'approved' }, 0), true)
  assert.equal(canRemove({ status: 'approved' }, 3), false)
  assert.equal(canRemove({ status: 'suggested' }, 0), true)
})

test('a value is tidied and a repeat is found whatever its capitalization', () => {
  assert.equal(cleanValue('  Youth   mental  health '), 'Youth mental health')
  assert.equal(cleanValue('   '), '')
  const all = [v('topics', 'Recycling')]
  assert.equal(hasValue(all, 'topics', ' recycling '), true)
  assert.equal(hasValue(all, 'sector', 'recycling'), false)
})
