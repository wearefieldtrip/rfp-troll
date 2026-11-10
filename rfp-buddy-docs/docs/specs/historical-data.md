# Historical data: import and reuse (plan)

Status: agreed approach, details to confirm. Built after steps 1 and 2.

## Sources

1. **RFP tracker** (Google Sheet, 2022–2026, 41 submissions). One row per submission: project, proposal title (Link), project type, client types, year, state, document type (RFP/RFI/RFQ), KY focus, a TRUE/FALSE column per proposal section, case studies used, won, response, prepared by.
2. **Past proposals**: Google Docs on the shared drive, with PDF exports. Titles match the tracker's Link column.
3. **Clients' original RFPs**, where available.
4. **RFPs and proposals not in the tracker.**

Pitch decks are not imported.

## Access

- Share the archive folders (or the shared drive) with the service account as Viewer.
- Configure: the tracker's file ID and the archive folder IDs.

## Import (one-time backfill, then automatic)

1. **Tracker rows → closed RFPs.** Normalize as you go:
   - outcome: Won / Lost / No response / Qualified,
   - furthest stage: Submitted / Finalist / Pitched,
   - reason, when given (e.g. Local agency),
   - spelling variants (SWHR/SHWR, K-12/K12, Solid Waste case-study names).
2. **Match proposals to rows** by title. Prefer the Google Doc; use the PDF only when no Doc exists.
3. **Classify other files** in the archive as our proposal, client's RFP, or form/attachment. Pair a client RFP with our proposal when they share a folder.
4. **Anything unmatched** goes to a "Review imports" list: the AI pre-fills client, year, client type and project type; outcome stays Unknown until someone sets it.
5. **Going forward**, a proposal is imported automatically when its RFP is marked Submitted and its outcome is recorded.

## Splitting proposals into sections

- Read the Doc through the Docs API; use headings as boundaries. Skip images; keep a link back to the source.
- Label each section with the tracker's own section names (About Fieldtrip, Capabilities, Experience, Approach, Short Bios, Long Bios, Case Studies, Cost Proposal, Diversity Statement, Let's Do This, and so on).
- Cross-check against the tracker: a column marked TRUE should produce that section; flag it if not.
- Split case studies one per case study, named with the tracker's codes (COVID, PMC, ECC…).

## Storage (Supabase)

One `content_sections` table: text, label, source Doc and link to the heading, tracker fields (client type, project type, year, state, KY focus, outcome, furthest stage), and flags: contains numbers/stats, names another client, is pricing.

No vector search to start: filtering by label and tracker fields leaves a handful of candidates for Claude to choose from. Add pgvector later if the library grows to several thousand sections or an open search box is needed.

## Use

- **Fit review:** a track-record line from similar past RFPs (e.g. "Civic transit, outside KY: 4 past RFPs, 0 won, 2 finalists"). Evidence beside the score, not a change to the rubric.
- **Proposal (step 3):** for each section the RFP requires, pull matching past sections (same client and project type first; won, then finalist, then lost; newer first). Claude picks the best and says why. Insert it word for word as a Google Docs suggestion, with a comment giving the source, year, outcome and any flags.
- **Case studies:** suggest 3, based on those used in similar wins and relevance to the RFP.
- **Evergreen sections** (About Fieldtrip, bios, statements) come from a "Current versions" page in the Library that the team maintains, not from old proposals.

## Guardrails

- Pricing is never reused.
- Other clients' names and old numbers are always flagged.
- Every reused section shows its source and year.

## Known gaps

- No budget or price column, so no budget benchmarks yet. Backfill if possible, at least for wins.
- Passed RFPs aren't in the tracker; the tool records them from now on.
