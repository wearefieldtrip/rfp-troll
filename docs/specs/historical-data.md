# Historical data: import and reuse (plan)

Two phases. **Phase A** is needed before step 3, because step 3 builds each new proposal from a similar past one. **Phase B** comes after step 3.

Tags for every RFP, new and past, are defined in `docs/specs/tagging.md`.

## Sources

1. **RFP tracker** (Google Sheet, tab "RFPs", submissions from 2022 to 2026; 50 rows when first read). One row per submission: project, proposal title (Link), project type, client types, year, state, document type (RFP/RFI/RFQ), KY focus, a TRUE/FALSE column per proposal section, case studies used, won, response, prepared by.
2. **Past proposals**: Google Docs on the shared drive, with PDF exports. Each tracker row's Link cell links to its proposal Doc (a link or Drive smart chip), so rows are linked by that link, not by guessing from titles.
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

## Built: tracker import (piece 3, 2026-11-11)

- **Library → Imports.** A person picks sheet rows (the sheet's own numbers; row 1 is the header), clicks **Preview** (writes nothing: new / update / left alone, outcomes, and the values that could not be mapped), then **Import** behind a confirmation. No AI is used. Start with a few rows.
- **One function, `import-tracker`.** It reads the sheet as the service account. The sheet ID and tab are function secrets (`TRACKER_SHEET_ID`, optional `TRACKER_SHEET_TAB`, default `RFPs`), not code. The sheet must be shared with the service account as Viewer, and the Sheets API enabled.
- **Each row becomes a closed RFP:** client = Project, title = the proposal title, status Closed · Won for a win and Closed · Lost for everything else, with `outcome` (won, lost, no response, qualified, unknown), `furthest_stage` (submitted, finalist, pitched), the reason (Local agency, No clarification) and a note ("Second place", "Won, but never took off", "The process took months"). The raw row (section TRUE/FALSE columns, case studies, who prepared it, the proposal link) is kept in `import_data` for Phase B. Nobody owns an imported RFP.
- **Safe to run again.** Each row has an import key (project, proposal title, year; ignoring case and punctuation) with a unique index, so a second run finds the RFP it made. A re-run updates rows nobody has reviewed, replaces only the earlier import tags, and never touches a row marked reviewed or a tag group set by hand. Editing the tags of an imported RFP counts as reviewing it. Each run has a batch id.
- **Tags from the tracker** are stored confirmed (source import). Client Type 1 → client type ("Noprofit" and "Philanthropy" → Nonprofit), Client Type 2 → sector, Project Type → services ("Brand - Survey" → Brand strategy + Research & discovery, "Campaign - Creative" → Campaign), Document Type → procurement, State and Louisville/KY focus → geography (a Kentucky RFP with no Louisville/KY focus gets only its state, not "Out of state"). Values with no match (blank sector, Childcare, Legal, IDD, Food, Support, MPO, Airport) import without that tag and are listed in `import_issues` for Review imports.
- **The RFP page for an imported RFP** shows a "From the RFP tracker" card (outcome, stage, reason, case studies, proposal link, what needs review) and the history; it has no steps. Imported RFPs appear under Won, Lost and All.
- **Not yet:** linking each row to its proposal Doc (the link is stored; piece 4 checks access and records the Doc and PDF), AI tagging from the Docs (piece 5), the Review imports screen (piece 6).

## Built: proposal links (piece 4, 2026-11-11)

- **Library → Imports → Proposal links.** For the same rows as the import (and only RFPs already imported): **Check links** (writes nothing) then **Save links**. No AI is used.
- **What it does.** The tracker already holds each proposal's link, so there is no searching by title. The function (`link-proposals`) reads the file id from the link, asks Drive what it is, and records on the RFP: `proposal_doc_id`, the Doc's name, a status (`linked`, `no_access`, `not_a_doc`, `no_link`), when it was checked, and the PDF beside the Doc whose name matches (`proposal_pdf_id`). A link that goes straight to a PDF is kept as the PDF. A link a person sets by hand (`proposal_link_source = person`) is never replaced.
- **First check, all 50 rows (2026-11-11):** 37 Docs open; 13 can't be opened by the service account (Home of the Innocents, JHF, Dare to Care, Rochester Public Schools, Children's Oncology Group, Olmsted County, Madison Metro School District, Springfield Public Schools, APH, SWHR, JCPS, Solid Waste, FCPS). They need to be shared with the service account as Viewer or moved into the shared drive, then checked again; until then they wait on Review imports.
- **PDF exports are rare:** only 3 of the 37 have a PDF with the proposal's name beside the Doc. The PDFs in those folders are mostly the *client's* RFP and its exhibits (for example "RFP 26-01 VentureWell Brand Refresh and Website Build.pdf"). Phase A step 4 (classify archive files and pair a client RFP with our proposal when they share a folder) is where those are picked up.
- **The imported RFP's page** shows "Open the proposal Doc" (and PDF when found), or says the Doc can't be opened yet.

## Built: AI tagging of past RFPs (piece 5, 2026-11-11)

- **Library → Imports → AI tagging.** For the same rows as the import. **Tag with AI** first counts what it would read (no AI), then asks for confirmation: how many proposal Docs, that it uses a small amount of AI credit, and what is skipped. A person starts every run.
- **What it does.** The function `tag-past-rfps` exports each linked proposal Doc as plain text (the first 100,000 characters), and the small model (Haiku) returns tags chosen only from the Library lists, with the team's own project type and sector as context. It adds **services, topics, audiences and requirements**, and a **sector only when the RFP has none** (the tracker's sector, or one a person set, stands). It reads at most 15 Docs per run so it finishes in time; run it again for the rest.
- **Only adds, never overwrites.** Everything is stored unconfirmed (source ai). A tracker tag (confirmed) is never changed, a group a person set by hand is skipped, and a re-run replaces only the AI's own earlier unconfirmed tags. Values not in a list are dropped; a new value it wants becomes a suggestion in Library → Tags.
- **Skipped:** RFPs already tagged (`ai_tagged_at`), RFPs marked reviewed, and RFPs with no linked Doc. A failed Doc is reported and tried again on the next run.
- **No separate preview.** A preview would cost the same credits as the run, so the confirmation replaces it. The results list shows what each RFP got, and nothing it adds is final until reviewed (piece 6).
- **Not built:** tagging the RFPs again after the lists change (an already-tagged RFP is skipped); audiences and topics the AI suggests wait on the Tags page.

- **First run, rows 2 to 4, found the prompt too loose.** A proposal also describes Fieldtrip (Capabilities, Experience, subcontractors), and the model tagged that as if the RFP had asked for it: a campaign RFP got eight services, and two RFPs got "Subcontractors allowed". Version 2 of the instructions says to tag only what the client's scope and requirements call for, ignores the sections about Fieldtrip, asks for the most important values first, and the app caps each group (services 6, topics 3, audiences 4, requirements 4). Each RFP records the version that tagged it (`ai_tag_version`), so raising the version in the function makes older results eligible to run again.
