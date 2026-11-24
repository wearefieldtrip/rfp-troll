import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { checkRubric } from './rubric-structure.ts'
import { changesOnly, diffLines, normalizeRubricDoc } from './rubric-doc.ts'

const shipped = readFileSync(new URL('../../docs/fit-rubric.md', import.meta.url), 'utf8')

// What Google's markdown export of the real rubric Doc looked like (2026-11-24).
const exported = [
  '# **Fieldtrip RFP Rubric**',
  '',
  'Score each dimension from 0 to 3, then add the four scores for a total out of 12. The total determines the next step.',
  '',
  '## **A. Mission and Segment Alignment**',
  '',
  '1.  **3 – Excellent:** Direct alignment with a core Fieldtrip segment. The mission is clear, and we can immediately see how to multiply it.',
  '2.  **2 – Good:** Adjacent segment or slightly vague mission, but highly positive social impact.',
  '3.  **1 – Fair:** Weak mission alignment or commercial client with a cause-marketing angle.',
  '4.  **0 – Poor:** No mission alignment or purely transactional commercial project.',
  '',
  '## **B. Budget and Value Health**',
  '',
  '1.  **3 – Excellent:** Budget is explicitly stated and matches the requested scope. Allows for healthy margins without cutting corners.',
  '2.  **2 – Good:** Budget is unstated but historical data or client type suggests a healthy standard range for this scope.',
  '3.  **1 – Fair:** Budget is low or tight, requiring scope compromises. High risk of over-functioning to deliver quality.',
  '4.  **0 – Poor / Auto No-Go:** Unrealistic budget or free/spec work required in the proposal itself.',
  '',
  '## **C. Scope and Relationship Boundaries**',
  '',
  '1.  **3 – Excellent:** Scope is tightly defined with clear deliverables. Client values strategic expertise. Fieldtrip has direct access to decision-makers.',
  '2.  **2 – Good:** Scope is mostly clear but has some open-ended elements. Access to decision-makers is limited to written Q\\&A.',
  '3.  **1 – Fair:** Vague scope that invites "do everything" expectations. No access to decision-makers.',
  '4.  **0 – Poor:** Extremely bloated scope designed to get maximum labor for minimum pay. Vague or shifting requirements.',
  '',
  '## **D. Timeline and Capacity Feasibility**',
  '',
  '1.  **3 – Excellent:** Proposal deadline is at least 3 to 4 weeks away. Project timeline meets or exceeds the standard benchmark for the scope type.',
  '2.  **2 – Good:** Proposal deadline is tight (1 to 2 weeks) but we have relevant templates. Project timeline is 20 to 30 percent shorter than the benchmark.',
  '3.  **1 – Fair:** Proposal deadline requires significant effort to meet. Project timeline is 40 to 50 percent shorter than the benchmark.',
  '4.  **0 – Poor:** Project timeline is so compressed relative to scope that delivering quality work without burning out the team is not feasible.',
  '',
  '## **Decision Matrix**',
  '',
  '1.  **10 – 12 · Definite Go:** Proceed to proposal drafting. Highly aligned, profitable, and manageable.',
  '2.  **7 – 9 · Conditional Go:** Proceed only if we can negotiate scope, clarify the budget, or secure direct access.',
  '3.  **4 – 6 · Likely No-Go:** Decline unless there is a strong strategic reason, such as a foot-in-the-door with a massive long-term client.',
  '4.  **0 – 3 · Definite No-Go:** Politely decline. Pursuing this trades team bandwidth for low-margin, high-stress work.',
  '',
  '  ',
].join('\n')

test("Google's export of the rubric Doc normalizes to exactly the shipped rubric", () => {
  assert.equal(normalizeRubricDoc(exported), shipped)
})

test('a normalized Doc passes the structure check', () => {
  assert.deepEqual(checkRubric(normalizeRubricDoc(exported)).problems, [])
})

test('a deleted score line is caught by the structure check after normalizing', () => {
  const broken = exported.replace(/^2\.  \*\*2 – Good:\*\* Adjacent.*\n/m, '')
  assert.ok(checkRubric(normalizeRubricDoc(broken)).problems.length > 0)
})

test('bullets, stars and windows line endings are normalized too', () => {
  assert.equal(normalizeRubricDoc('## **A. X**\r\n\r\n* **3 – Top:** a\\&b\r\n'), '## A. X\n\n- **3 – Top:** a&b\n')
})

test('the diff lists only what changed, under its heading', () => {
  const after = shipped.replace('Adjacent segment or slightly vague mission', 'Adjacent segment or a vague mission')
  const changes = changesOnly(diffLines(shipped, after))
  assert.equal(changes.length, 2)
  assert.deepEqual(changes.map((c) => c.kind), ['removed', 'added'])
  assert.ok(changes.every((c) => c.heading === 'A. Mission and Segment Alignment'))
  assert.deepEqual(changesOnly(diffLines(shipped, shipped)), [])
})
