import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  bankForPrompt,
  cleanKeep,
  countQuestions,
  cutRequests,
  fillRequests,
  questionStarts,
  parseTemplate,
  pendingSuggestions,
  suggestRequests,
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

test('each suggestion goes above a different library question, highest position first', () => {
  const content = template()
  const starts = questionStarts(content)
  assert.deepEqual(starts, [content[3].startIndex, content[4].startIndex, content[5].startIndex, content[8].startIndex])
  const requests = suggestRequests(starts, 999, ['  One?  ', 'Two\nlines?', ' ', 'Three?']) as { insertText: { location: { index: number }; text: string } }[]
  assert.deepEqual(
    requests.map((r) => [r.insertText.location.index, r.insertText.text]),
    [[starts[2], 'Three?\n'], [starts[1], 'Two lines?\n'], [starts[0], 'One?\n']],
  )
})

test('questions beyond the library questions go to the end, and nothing gives an empty list', () => {
  const requests = suggestRequests([10, 20], 99, ['a?', 'b?', 'c?', 'd?']) as { insertText: { location: { index: number }; text: string } }[]
  assert.deepEqual(requests.map((r) => r.insertText.location.index), [99, 20, 10])
  assert.equal(requests[0].insertText.text, 'c?\nd?\n')
  assert.deepEqual(suggestRequests([10], 99, []), [])
  assert.equal((suggestRequests([], 99, ['a?']) as unknown[]).length, 1)
})

test('counts only top-level questions', () => {
  assert.equal(countQuestions(template()), 4)
})

test('finds suggestions that are still waiting', () => {
  assert.equal(pendingSuggestions({ body: { content: [{ paragraph: { elements: [{ textRun: { suggestedInsertionIds: ['a'] } }] } }] } }), 1)
  assert.equal(pendingSuggestions({ x: [{ suggestedDeletionIds: ['b'] }, { suggestedInsertionIds: ['b', 'c'] }] }), 2)
  assert.equal(pendingSuggestions({ body: {} }), 0)
})
