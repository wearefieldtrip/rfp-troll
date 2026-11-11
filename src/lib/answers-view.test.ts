import assert from 'node:assert/strict'
import { test } from 'node:test'
import { answersState, movedText, stillUnanswered, toAnswersResult } from './answers-view.ts'

const review = {
  version: 2,
  dimensions: [
    { key: 'A', score: 3 },
    { key: 'B', score: 1 },
    { key: 'C', score: 2 },
    { key: 'D', score: 0 },
  ],
  questions: ['About A?', 'About B?', 'No line?', 'About D?', 'About C?'],
  question_lines: ['A', 'B', null, 'D', 'C'],
}

test('the open questions that matter most come first: the lowest-scoring line', () => {
  assert.deepEqual(
    stillUnanswered(review).map((q) => q.question),
    ['About D?', 'About B?', 'About C?'],
  )
  assert.equal(stillUnanswered(review)[0].line, 'D')
})

test('questions with no line come after those with one, in their own order', () => {
  const r = { ...review, questions: ['x?', 'y?'], question_lines: [null, null] }
  assert.deepEqual(stillUnanswered(r, 5).map((q) => q.question), ['x?', 'y?'])
})

test('an older review with no lines, or no review, gives a sensible list', () => {
  assert.deepEqual(stillUnanswered({ version: 2, dimensions: [], questions: ['a?'] }).map((q) => q.line), [null])
  assert.deepEqual(stillUnanswered(null), [])
  assert.deepEqual(stillUnanswered({ summary: 'v1' }), [])
})

test('a stored result is read defensively', () => {
  assert.equal(toAnswersResult(null), null)
  const r = toAnswersResult({
    what_changed: [{ text: 'Budget confirmed', answer: 4 }, { text: '', answer: 1 }],
    unanswered: [{ question: 'Who approves?', line: 'C' }, { question: 'Odd', line: 'Z' }],
    moved: [{ key: 'B', from: 1, to: 2 }, { key: 'Q', from: 0, to: 1 }],
    total: 9,
  })
  assert.equal(r?.what_changed.length, 1)
  assert.deepEqual(r?.unanswered.map((u) => u.line), ['C', null])
  assert.equal(r?.moved.length, 1)
  assert.equal(r?.other_agencies, '')
  assert.deepEqual(r?.changes, [])
})

test('says which line moved', () => {
  assert.equal(movedText([]), 'No rubric line moved.')
  assert.equal(movedText([{ key: 'B', from: 1, to: 2 }]), 'Budget and value moved from 1 to 2.')
  assert.equal(movedText([{ key: 'B', from: 1, to: 2 }, { key: 'D', from: 1, to: 0 }]), 'Budget and value moved from 1 to 2; Timeline and capacity moved from 1 to 0.')
})

test('a reading that never finishes becomes a failure that can be retried', () => {
  const created = '2026-11-11T10:00:00Z'
  assert.equal(answersState({ status: 'reading', created_at: created }, new Date('2026-11-11T10:05:00Z')), 'reading')
  assert.equal(answersState({ status: 'reading', created_at: created }, new Date('2026-11-11T10:20:00Z')), 'failed')
  assert.equal(answersState({ status: 'done', created_at: created }, new Date('2027-01-01T00:00:00Z')), 'done')
})
