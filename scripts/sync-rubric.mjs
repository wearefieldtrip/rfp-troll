// The fit rubric lives in docs/fit-rubric.md. Edit that file, then run `npm run rubric` to copy it into the two
// functions that score with it (review-rfp and read-answers), and deploy those two functions.
// Each review records which version it used: the first review after a change saves the new text as the next version.
import { readFileSync, writeFileSync } from 'node:fs'

const text = readFileSync(new URL('../docs/fit-rubric.md', import.meta.url), 'utf8')
const body = `// Generated from docs/fit-rubric.md by \`npm run rubric\`. Do not edit here.\nexport const RUBRIC = ${JSON.stringify(text)};\n`

for (const fn of ['review-rfp', 'read-answers']) {
  writeFileSync(new URL(`../supabase/functions/${fn}/rubric-text.ts`, import.meta.url), body)
  console.log(`Updated supabase/functions/${fn}/rubric-text.ts`)
}
