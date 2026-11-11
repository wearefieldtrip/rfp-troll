import assert from 'node:assert/strict'
import { test } from 'node:test'
import { describeActions, describeAdded, describeLinks, describeOutcomes, parseRowNumber } from './import-view.ts'

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

test('links read as a short sentence and leave out zeros', () => {
  assert.equal(describeLinks({ linked: 37, no_access: 13, not_a_doc: 0, no_link: 0, withPdf: 31 }), "37 linked · 13 can't be opened · 31 with a PDF")
  assert.equal(describeLinks({ linked: 0, no_access: 0, not_a_doc: 0, no_link: 0, withPdf: 0 }), '')
})

test('what the AI added reads group by group, in a fixed order', () => {
  assert.equal(describeAdded({ topics: ['recycling'], services: ['Translation', 'Accessibility'], sector: ['Transit'] }), 'Sector: Transit · Services: Translation, Accessibility · Topics: recycling')
  assert.equal(describeAdded({}), '')
  assert.equal(describeAdded(undefined), '')
})
