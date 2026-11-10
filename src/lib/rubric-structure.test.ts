import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { bandFor, checkRubric, cleanBandLabel, parseBands } from './rubric-structure.ts'

const rubric = readFileSync(new URL('../../docs/fit-rubric.md', import.meta.url), 'utf8')

test("the shipped rubric (docs/fit-rubric.md) has the fixed structure", () => {
  const { problems, bands } = checkRubric(rubric)
  assert.deepEqual(problems, [])
  assert.deepEqual(
    bands.map((b) => [b.min, b.max, b.label]),
    [
      [10, 12, 'Definite Go'],
      [7, 9, 'Conditional Go'],
      [4, 6, 'Likely No-Go'],
      [0, 3, 'Definite No-Go'],
    ],
  )
})

test('every total from 0 to 12 lands in exactly one band', () => {
  const bands = parseBands(rubric)
  const expected = (t: number) => (t >= 10 ? 'Definite Go' : t >= 7 ? 'Conditional Go' : t >= 4 ? 'Likely No-Go' : 'Definite No-Go')
  for (let total = 0; total <= 12; total++) assert.equal(bandFor(total, bands)?.label, expected(total), `total ${total}`)
  assert.equal(bandFor(13, bands), null)
})

test('wording can change without breaking the structure', () => {
  const reworded = rubric.replace('Definite Go', 'Do not hesitate').replace('Excellent', 'Outstanding')
  assert.deepEqual(checkRubric(reworded).problems, [])
})

test('a missing dimension is reported', () => {
  const broken = rubric.replace('## C. Scope and Relationship Boundaries', '## Scope')
  assert.match(checkRubric(broken).problems.join(' '), /Dimension C is missing/)
})

test('a missing score level is reported', () => {
  const broken = rubric.replace(/^- \*\*2 – Good:\*\* Adjacent segment.*$/m, '')
  assert.match(checkRubric(broken).problems.join(' '), /Dimension A needs a line for score 2/)
})

test('matrix gaps, overlaps and a wrong top are reported', () => {
  const gap = rubric.replace('**7 – 9 · Conditional Go:**', '**8 – 9 · Conditional Go:**')
  assert.match(checkRubric(gap).problems.join(' '), /no gaps or overlaps/)
  const overlap = rubric.replace('**4 – 6 · Likely No-Go:**', '**3 – 6 · Likely No-Go:**')
  assert.match(checkRubric(overlap).problems.join(' '), /no gaps or overlaps/)
  const lowTop = rubric.replace('**10 – 12 · Definite Go:**', '**10 – 11 · Definite Go:**')
  assert.match(checkRubric(lowTop).problems.join(' '), /0 to 12/)
})

test('a missing matrix is reported', () => {
  const broken = rubric.slice(0, rubric.indexOf('## Decision Matrix'))
  assert.match(checkRubric(broken).problems.join(' '), /decision matrix is missing/)
})

test('older stored band labels are cleaned', () => {
  assert.equal(cleanBandLabel('7 – 9 · Conditional Go'), 'Conditional Go')
  assert.equal(cleanBandLabel('Definite Go'), 'Definite Go')
  assert.equal(cleanBandLabel(null), '')
})
