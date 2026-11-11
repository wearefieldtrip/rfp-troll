import assert from 'node:assert/strict'
import { test } from 'node:test'
import { planTagSave, toggleChoice, type CurrentTag } from './tag-edit.ts'

const tag = (id: string, tag_value_id: string, tag_group: string, confirmed = false): CurrentTag => ({ id, tag_value_id, tag_group, confirmed })

const current = [tag('r1', 'v-web', 'services'), tag('r2', 'v-brand', 'services'), tag('r3', 'v-transit', 'sector'), tag('r4', 'v-youth', 'audiences', true)]

test('a group left as it was changes nothing', () => {
  const plan = planTagSave(current, new Map([['services', new Set(['v-web', 'v-brand'])], ['sector', new Set(['v-transit'])]]))
  assert.deepEqual(plan, { removeIds: [], addValueIds: [], confirmIds: [], changedGroups: [] })
})

test('a changed group adds, removes and confirms what stays', () => {
  const plan = planTagSave(current, new Map([['services', new Set(['v-web', 'v-campaign'])]]))
  assert.deepEqual(plan.removeIds, ['r2'])
  assert.deepEqual(plan.addValueIds, ['v-campaign'])
  assert.deepEqual(plan.confirmIds, ['r1'])
  assert.deepEqual(plan.changedGroups, ['services'])
})

test('clearing a group removes its tags; an already confirmed tag is not confirmed again', () => {
  const plan = planTagSave(current, new Map([['audiences', new Set<string>()], ['services', new Set(['v-web', 'v-brand'])]]))
  assert.deepEqual(plan.removeIds, ['r4'])
  assert.deepEqual(plan.confirmIds, [])
  assert.deepEqual(plan.changedGroups, ['audiences'])
})

test('a group the dialog did not show is never touched', () => {
  const plan = planTagSave(current, new Map([['sector', new Set(['v-health'])]]))
  assert.deepEqual(plan.removeIds, ['r3'])
  assert.deepEqual(plan.addValueIds, ['v-health'])
})

test('one-value groups hold one choice, and picking it again clears it', () => {
  assert.deepEqual([...toggleChoice(new Set(['a']), 'b', false)], ['b'])
  assert.deepEqual([...toggleChoice(new Set(['a']), 'a', false)], [])
})

test('many-value groups toggle each choice', () => {
  assert.deepEqual([...toggleChoice(new Set(['a']), 'b', true)].sort(), ['a', 'b'])
  assert.deepEqual([...toggleChoice(new Set(['a', 'b']), 'a', true)], ['b'])
})
