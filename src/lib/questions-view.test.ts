import assert from 'node:assert/strict'
import { test } from 'node:test'
import { docContents, formatDay, todayInputValue } from './questions-view.ts'

test('today is written the way a date input wants it', () => {
  assert.equal(todayInputValue(new Date(2026, 10, 5)), '2026-11-05')
})

test('a day is written without shifting it a day', () => {
  assert.equal(formatDay('2026-11-11'), 'Nov 11, 2026')
  assert.equal(formatDay('2027-01-01'), 'Jan 1, 2027')
})

test('says what the doc holds', () => {
  assert.equal(docContents(11, 8), '11 template questions and 8 AI suggested questions')
  assert.equal(docContents(1, 1), '1 template question and 1 AI suggested question')
  assert.equal(docContents(9, 0), '9 template questions')
  assert.equal(docContents(null, null), '0 template questions')
})
