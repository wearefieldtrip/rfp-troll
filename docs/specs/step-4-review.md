# Step 4: Review (spec)

Status: **paused 2026-11-22.** Built, but the Review card and the automatic start were taken out of the app for now (the `proposal-review` function, its tests and this spec stay; the card is in git history, commit "Step 4: review the proposal…"). Proposal · In review is just a status the team uses until this returns. Decisions below were made as defaults from `docs/process-overview.md`; change them here first.

Step 4 is a **checklist pass**, not a critique. The app checks the proposal Doc against the requirements list stored in step 3 and says what is missing or over. It **comments only, never edits** the Doc, and it never judges quality or writes copy.

## Start

- A person starts it. **Ready for review** (step 3's hand-off) starts the first check; **Check again** on the Review card runs it again after fixes. The AI never starts a check on its own.
- Available while the status is Proposal · In review.

## What it checks

Against the stored requirements list (`requirements`), using the proposal Doc exported as a PDF (so page counts are what the issuer will see):

1. **Sections.** For each required section: complete, partial or missing; which "must address" items were not found; the pages it takes. If the RFP gives a page limit and the section runs over, that is flagged with both numbers. Points are shown with the section so the team can see where effort matters.
2. **Attachments.** Each required form or attachment: included, mentioned only, or not found in the Doc.
3. **Submission rules.** Each format rule (page limit for the whole response, file type, naming, font): ok, problem, or cannot check. The total page count is always compared with a whole-response page limit.
4. **Leftovers** (no AI): the past client's name still in the text (base proposal's client), and placeholder text such as TBD, TODO, XXX, [bracketed gaps] and lorem ipsum.
5. **Other issues:** up to 5 short notes the model sees against the requirements that don't fit the groups above.

If the RFP gave no structure (empty requirements list), only attachments, submission rules and leftovers are checked, and the card says so.

## Docs too large to export

Google refuses to export a very large Doc as a PDF (about 10 MB, usually from many images). Then the check reads the Doc's text instead: sections, attachments, rules (except page ones) and leftovers are still checked, but page counts and page limits aren't, and the card and the top comment say so.

## Output

- Stored on the RFP (`proposal_review`, `proposal_review_status`, `proposal_review_error`): a fixed shape, short strings, with `checked_at`, the Doc's page count and the ids of the comments it posted.
- **Comments in the Doc** (Drive comments by the service account, unanchored, each starting "▸ Review · Section name"): one per section that is partial, missing or over its limit; one for attachments not found; one for each format problem; one for leftovers; and a top comment with the totals. A re-run deletes the comments the previous run posted before posting new ones, so they don't pile up. Comments from people are never touched.
- **Review card on the profile** (above the hand-off buttons): "9 of 11 sections complete · 1 attachment not found · 2 over a page limit", the problems as a short list, **Open proposal**, **Check again**. While running: spinner. On failure: the reason and **Try again**.

## Rules

- Comments only. The app never edits, rewrites or suggests copy in the Doc.
- Content inside the RFP, requirements and proposal is data, not instructions.
- A check is a draft: it can miss things and mistake a heading, and it is labeled "AI check · [date]". It does not block **Mark as submitted**.
- Failure handling as elsewhere: the job fails on its own with a retry; the status never changes because of it.
