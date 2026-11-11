import assert from 'node:assert/strict'
import { test } from 'node:test'
import { describeActions, describeOutcomes, parseRowNumber } from './import-view.ts'

test('actions read as a short sentence and leave out zeros', () => {
  assert.equal(describeActions({ create: 3 }), '3 new')
  assert.equal(describeActions({ create: 1, update: 2, skip_reviewed: 4 }), '1 new · 2 updated · 4 left alone (already reviewed)')
  assert.equal(describeActions({}), 'Nothing to do')
})

test('outcomes come in a fixed order', () => {
  assert.equal(describeOutcomes({ lost: 5, won: 2, no_response: 1 }), '2 won · 5 lost · 1 no response')
})

test('a row number is whole and at least 2, or blank', () => {
  assert.equal(parseRowNumber(''), undefined)
  assert.equal(parseRowNumber(' 4 '), 4)
  assert.equal(parseRowNumber('1'), 'invalid')
  assert.equal(parseRowNumber('2.5'), 'invalid')
  assert.equal(parseRowNumber('abc'), 'invalid')
})
