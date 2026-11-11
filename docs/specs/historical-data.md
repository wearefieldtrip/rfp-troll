# Historical data: import and reuse (plan)

Two phases. **Phase A** is needed before step 3, because step 3 builds each new proposal from a similar past one. **Phase B** comes after step 3.

Tags for every RFP, new and past, are defined in `docs/specs/tagging.md`.

## Sources

1. **RFP tracker** (Google Sheet, 2022–2026, 41 submissions). One row per submission: project, proposal title (Link), project type, client types, year, state, document type (RFP/RFI/RFQ), KY focus, a TRUE/FALSE column per proposal section, case studies used, won, response, prepared by.
2. **Past proposals**: Google Docs on the shared drive, with PDF exports. Titles match the tracker's Link column.
3. **Clients' original RFPs**, where available.
4. **RFPs and proposals not in the tracker.**

Pitch decks are not imported.

## Access

- Share the archive folders (or the shared drive) with the service account as Viewer.
- Configure: the tracker's file ID and the archive folder IDs.

## Phase A: tracker, links and tags (before step 3)

1. **Tracker rows → closed RFPs.** Normalize as you go:
   - outcome: Won / Lost / No response / Qualified,
   - furthest stage: Submitted / Finalist / Pitched,
   - reason, when given (e.g. Local agency),
   - spelling variants (SWHR/SHWR, K-12/K12, Solid Waste case-study names).
2. **Link each row to its proposal Doc** by title. Prefer the Google Doc; record the PDF too. Rows with no Doc found go to Review imports.
3. **Tag every imported RFP** using the backfill rules in the tagging spec. The AI reads each linked proposal Doc to add services, topics, audiences and requirements; those stay unconfirmed until reviewed.
4. **Other files in the archive:** classify each as our proposal, client's RFP, or form/attachment. Pair a client RFP with our proposal when they share a folder. Anything unmatched goes to Review imports with client, year and tags pre-filled and outcome Unknown.
5. **Review imports list:** one screen where the team confirms tags, outcomes and links, one row at a time.
6. **RFP list:** imported RFPs appear under Won, Lost and All.

Phase A gives step 3 what it needs: a ranked list of similar past proposals with a Doc to copy.

## Phase B: sections and reuse (after step 3)

### Splitting proposals into sections

- Read each Doc through the Docs API; use headings as boundaries. Skip images; keep a link back to the source.
- Label each section with the tracker's own section names (About Fieldtrip, Capabilities, Experience, Approach, Short Bios, Long Bios, Case Studies, Cost Proposal, Diversity Statement, Let's Do This, and so on).
- Cross-check against the tracker: a column marked TRUE should produce that section; flag it if not.
- Split case studies one per case study, named with the tracker's codes (COVID, PMC, ECC…).

### Storage (Supabase)

One `content_sections` table: text, label, source Doc and link to the heading, the source RFP (and through it, its tags and outcome), and flags: contains numbers/stats, names another client, is pricing.

No vector search to start: filtering by label and tags leaves a handful of candidates for Claude to choose from. Add pgvector later if the library grows to several thousand sections or an open search box is needed.

### Use

- **Proposal (step 3, later pieces):** for sections the base proposal didn't cover well, pull matching past sections (ranked by the tagging spec's similarity; won, then finalist, then lost). Claude picks the best and says why. Insert it word for word as a Google Docs suggestion, with a comment giving the source, year, outcome and any flags.
- **Case studies:** suggest 3, based on those used in similar wins and relevance to the RFP.
- **Evergreen sections** (About Fieldtrip, bios, statements) come from a "Current versions" page in the Library that the team maintains, not from old proposals.

## Fit review use (after Phase A)

A track-record line from similar past RFPs, e.g. "Civic transit, outside KY: 4 past RFPs, 0 won, 2 finalists." Evidence beside the score, not a change to the rubric.

## Going forward

A proposal is linked and tagged automatically when its RFP is marked Submitted; its sections are split (Phase B) when its outcome is recorded.

## Guardrails

- Pricing is never reused.
- Other clients' names and old numbers are always flagged.
- Every reused section shows its source and year.

## Known gaps

- No budget or price column in the tracker, so no budget bands for past RFPs yet. Backfill if possible, at least for wins.
- Passed RFPs aren't in the tracker; the tool records them from now on.
