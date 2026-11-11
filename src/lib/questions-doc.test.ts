import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  bankForPrompt,
  cleanKeep,
  countQuestions,
  cutRequests,
  fillRequests,
  firstQuestionStart,
  parseTemplate,
  pendingSuggestions,
  suggestRequest,
  type DocElement,
} from './questions-doc.ts'

let cursor = 1
const p = (text: string, bullet: number | null = null): DocElement => {
  const startIndex = cursor
  cursor += text.length + 1
  return {
    startIndex,
    endIndex: cursor,
    paragraph: { elements: [{ textRun: { content: `${text}\n` } }], paragraphStyle: { namedStyleType: 'NORMAL_TEXT' }, ...(bullet === null ? {} : { bullet: { nestingLevel: bullet } }) },
  }
}
const table = (): DocElement => {
  const startIndex = cursor
  cursor += 50
  return { startIndex, endIndex: cursor, table: {} }
}

// Shaped like the real template: header, intro, questions (some with options and a table), then guidelines.
const template = (): DocElement[] => {
  cursor = 1
  return [
    p('Q U E S T I O N S'),
    p('RFP:\t#'),
    p('We are curious people.'),
    p('Describe the pain point that led to this RFP.', 0),
    p('Describe where you see CLIENT in three years.', 0),
    p('How will agency services be used?', 0),
    table(),
    p(''),
    p('Which relationship?', 0),
    p('Follow orders', 1),
    p('Team player', 1),
    p('Guidelines:'),
    p('Avoid closed-ended questions.', 0),
    p(''),
  ]
}

test('groups each question with its options, table and blank lines', () => {
  const layout = parseTemplate(template())
  assert.equal(layout.groups.length, 4)
  assert.match(layout.groups[3].text, /Which relationship\?\n {3}- Follow orders\n {3}- Team player/)
  assert.match(layout.groups[2].text, /\[a table to fill in\]/)
  // The table group reaches through the blank paragraph after it.
  assert.equal(layout.groups[2].end, layout.groups[3].start)
})

test('the guidelines are found and are never counted as questions', () => {
  const layout = parseTemplate(template())
  assert.ok(layout.guidelinesStart)
  assert.ok(layout.groups.every((g) => !g.text.includes('closed-ended')))
})

test('cuts run from the end of the document to the start, guidelines first', () => {
  const layout = parseTemplate(template())
  const requests = cutRequests(layout, new Set([0, 3])) as { deleteContentRange: { range: { startIndex: number; endIndex: number } } }[]
  const starts = requests.map((r) => r.deleteContentRange.range.startIndex)
  assert.deepEqual(starts, [...starts].sort((a, b) => b - a))
  assert.equal(starts[0], layout.guidelinesStart)
  assert.equal(requests[0].deleteContentRange.range.endIndex, layout.docEnd - 1)
  // Questions 2 and 3 (positions 1 and 2) are dropped.
  assert.equal(requests.length, 3)
})

test('keeping everything cuts only the guidelines', () => {
  const layout = parseTemplate(template())
  assert.equal(cutRequests(layout, new Set([0, 1, 2, 3])).length, 1)
})

test('cleanKeep drops numbers outside the library and duplicates', () => {
  assert.deepEqual([...cleanKeep([1, 1, 4, 5, 0, 2.5, 'x'], 4)].sort(), [0, 3])
  assert.equal(cleanKeep('nope', 4).size, 0)
})

test('the model sees the questions numbered from 1', () => {
  assert.match(bankForPrompt(parseTemplate(template()).groups), /^1\. Describe the pain point/)
})

test('the client name is only filled in when there is one', () => {
  assert.equal(fillRequests({ title: 'T', clientName: null, date: 'D' }).length, 2)
  assert.equal(fillRequests({ title: 'T', clientName: 'Riverbend', date: 'D' }).length, 3)
})

test('suggestions go above the first remaining question, one list item each', () => {
  const content = template()
  assert.equal(firstQuestionStart(content), content[3].startIndex)
  assert.deepEqual(suggestRequest(10, ['  One?  ', 'Two\nlines?', ' ']), { insertText: { location: { index: 10 }, text: 'One?\nTwo lines?\n' } })
  assert.equal(suggestRequest(10, []), null)
})

test('counts only top-level questions', () => {
  assert.equal(countQuestions(template()), 4)
})

test('finds suggestions that are still waiting', () => {
  assert.equal(pendingSuggestions({ body: { content: [{ paragraph: { elements: [{ textRun: { suggestedInsertionIds: ['a'] } }] } }] } }), 1)
  assert.equal(pendingSuggestions({ x: [{ suggestedDeletionIds: ['b'] }, { suggestedInsertionIds: ['b', 'c'] }] }), 2)
  assert.equal(pendingSuggestions({ body: {} }), 0)
})
