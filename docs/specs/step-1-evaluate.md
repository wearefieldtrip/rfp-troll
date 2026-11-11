# Step 1: Evaluate (spec)

Design reference: `docs/design/S1-*.dc.html`.

## Flow

1. **RFP list → New RFP.** A modal opens with a single upload field (one file: the RFP) and an **Add RFP** button, disabled until a file is chosen.
2. **On Add RFP**, the app immediately:
   - saves the file,
   - creates the RFP profile with status **Reading…**,
   - closes the modal and takes the user to the new profile, which shows skeleton placeholders in the final layout while data loads.
3. **Pull client name and RFP name** (fast, about 10 seconds). The profile header and list row fill in first.
4. **Create the Drive folder** in Prospective Clients, named with the **client name only**, and copy the RFP into it.
   - If a folder with that client name already exists, reuse it and add the file there.
   - Match the client name ignoring case, spacing and punctuation. Only look at folders directly inside Prospective Clients, and skip folders whose names start with an underscore (`_DEAD Opportunities` and similar).
   - The RFP goes straight into the client folder. The app does not create subfolders.
5. **Full AI review** (starts automatically when the RFP is added, and runs alongside step 4):
   - Key dates: proposal due, questions (see below), vendor/winner selection.
   - Budget (see below).
   - Score against the Fieldtrip rubric (`docs/fit-rubric.md`: A–D, 0–3 each, total out of 12).
6. **Profile fills in** with the findings. Status becomes **Evaluate · Ready for decision**.

While loading, a progress strip shows each job: RFP saved · Client and RFP name · Drive folder · Dates and fit review, plus "Usually 2–3 minutes. You can leave this page."

## Fit review output

The model returns a fixed shape. The limits keep the page short whatever the RFP's length.

```json
{
  "verdict": "one sentence",
  "dimensions": [
    { "key": "A", "score": 3, "reason": "one sentence", "evidence": [{ "quote": "short quote from the RFP", "page": 4 }] }
  ],
  "risks": ["max 3, most serious first"],
  "questions": ["max 8, no duplicates, each one closes a gap"],
  "flags": ["only real problems, e.g. the RFP is future-dated or calls itself fictional"],
  "auto_no_go": "one sentence when the rubric's automatic no-go applies, otherwise empty"
}
```

- The scale is fixed: each dimension 0 to 3, total out of **12**. The model returns scores only. The app adds them up, checks that A–D are all present and between 0 and 3 (otherwise the review fails with a retry), and picks the band from the rubric's decision-matrix ranges (Definite Go, Conditional Go, Likely No-Go, Definite No-Go). The model never supplies a maximum or a band.
- Each dimension: up to 2 evidence quotes. A page the model can't tell is stored as no page.
- The app applies the limits itself (3 risks, 8 questions, 2 quotes), drops duplicate questions, and rejects a review whose dimensions or scores are wrong. The review then fails with a retry.
- Instructions found inside the RFP are ignored for scoring and may be reported as a flag.

## Running the review

- The **first review starts automatically** when the RFP is added. Adding the RFP is the person starting it.
- Every later run (**Run review again**, in the ⋯ menu or under the fit card) is started by a person and first asks for confirmation. The modal says a review uses paid AI credits, without giving a price.
- Move forward and Pass are inactive until a review has completed.

## Rubric rules

- The structure is fixed: four dimensions A–D, scored 0 to 3, total out of 12, with the four decision bands by range.
- The rubric editor may change wording (descriptions, labels, the matrix text). On save it checks that A–D are still there, every dimension has levels 0 to 3, and the matrix ranges cover 0 to 12 with no gaps or overlaps. A rubric that fails the check can't be saved.
- The rubric stored in the app is the live copy. `docs/fit-rubric.md` is the starting version.

## Profile layout rule

The profile always stacks in step order: header, pills, then one section per step (1 · Evaluate, 2 · Questions, and so on).

- The current step is expanded and holds the next action.
- Completed steps collapse to a one-line summary (e.g. "1 · Evaluate · Fit review · 7 / 12 · Conditional Go · Show") plus the decision record ("You moved this forward on Nov 10 at 2:31 PM."). They expand on click.
- Steps never reorder, so the page reads top to bottom in the order things happened.

## Profile, Evaluate · Ready for decision

Top to bottom:

1. Back link, client name, RFP title, status pill, **⋯ menu** (Run review again, Replace RFP file, Edit details, Change owner, Delete RFP; Reopen when closed).
2. Pills (below).
3. **Check this** note, only when the review returns a flag.
4. **Fit card**: total (e.g. 7 / 12), band badge, verdict sentence, **Move forward** and **Pass** buttons. Under it, the four rubric rows (name, score, reason); clicking a row shows its evidence quotes with page numbers. "AI review · [date] · Run again".
5. **Top risks** (full width).
6. **Questions to ask** (full width): first 5, "Show all".

## Pills at the top of the profile

Always shown, in this order:

1. **Proposal due** [date, time, time zone] · [N days]
2. **Questions** (see below) · [N days] when a due date exists
3. **Vendor selected** [date] · [N days]
4. **Budget** (see below)
5. **Drive folder** (link)

Day counts are calendar days from today to the date. A date that isn't in the RFP shows "Not stated" with no count. There is no separate countdown banner; the day counts live in the pills.

## Questions tag (always shown)

Exactly one of:

- **Questions: Not allowed** (only when the RFP explicitly says so)
- **Questions: Due [date], [time] [time zone]** (e.g. Due Dec 29, 2026, 5:00 PM ET)
- **Questions: Not stated**

"Not stated" and "Not allowed" must never be merged.

## Budget pill (always shown)

- **Stated:** **Budget** $95K–$125K · all-inclusive (the amount or range from the RFP, plus a short qualifier such as "all-inclusive" or "plus media").
- **Not stated:** **Budget** Not stated · est. $40K–$70K from 990.
  - The estimate is only run when the RFP has no budget.
  - For nonprofits: look up the organization's latest Form 990 through the ProPublica Nonprofit Explorer API (by name and state, then EIN).
  - **Changed from the first draft:** the API returns total expenses but not the advertising or outside-fees lines (those exist only in the filing PDF, which ProPublica does not serve to apps). The estimate is therefore sized from **total expenses alone**: 0.3% to 0.9% of total expenses, at least $10K to $25K, never above $400K, rounded to $5K. It is a rough guide to scale, not a budget, and is labeled as such. The rule is one small function (`src/lib/nonprofit-estimate.ts`) to tune once past proposals give budgets to compare against.
  - The match must be clear: an exact name (ignoring Inc, The, of) in the RFP's state, or an exact name when the state isn't known. Two matches, or a close but inexact name, give no estimate rather than a guess.
  - Show the tax year, the figures used, and the EIN matched so the team can catch a wrong match.
  - Organizations that don't file a full 990 (government and civic bodies, 990-N filers): **Budget** Not stated · no estimate available.
  - Dimension B can score at most 2 whenever the RFP states no budget (an estimate does not count as stated). The app enforces this: a 3 is lowered to 2 and the reason says so.
- **How the stated budget is stored.** Whole US dollars: a single amount has min = max; a range has both; "up to" has only a max; "at least" has only a min. A short qualifier (at most a few words, such as "all-inclusive" or "plus media"; a longer sentence is left out) and a quote from the RFP are kept with it. A budget a person types in the Edit details dialog (⋯ menu) is marked as entered by the team. The pill shows the amount short ("$95K–$125K"), and hovering shows the RFP's own wording.

## Decision buttons and confirmation

Both buttons open a confirmation modal. Nothing happens until the user confirms.

**Move forward.** The label and destination follow the Questions tag:

- Questions due (deadline not passed) or Not stated → **Move to Questions**
- Not allowed, or the deadline has passed → **Move to Proposal**

The confirmation modal ("Move to Questions?") lists what will happen:

- Change the status to Questions · Drafting (or Proposal · Drafting)
- Record the decision with the current score
- For Move to Questions: create the questions doc from the template and add the fit review's questions to it as suggestions (see the step 2 spec). This is the confirmed start of that AI step.

It also shows the questions deadline and days left. Buttons: Cancel, Move to Questions.

On confirm, record who decided, when, and the score at that moment. The status change and the record are saved together in one database call (`decide_rfp`); the record is append-only (`rfp_decisions`). Reopening a closed RFP is also recorded.

**Pass.** The confirmation modal ("Pass on this RFP?"):

- Says it moves to Closed · Passed and can be reopened later.
- Requires a reason: Budget, Timeline, Not a fit, Capacity, Scope, Other.
- Has an optional note.
- The Pass button stays disabled until a reason is chosen.

On confirm, record who decided, when, the reason, the note, and the score at that moment. The Drive folder moves first; if saving the decision fails, the folder is moved back.

## Dates and times

- Every date shows its time and time zone when the RFP gives them.
- Store each date as a moment: the instant (timestamp with time zone), whether the RFP gave a time, the time zone (an IANA name such as America/New_York), and the RFP's own wording as a short quote. Three dates are stored this way: proposal due, questions due, vendor selection.
- A day with no time is stored as that day at 12:00 UTC and shown as a day only, so it never shifts across time zones.
- Day counts use the calendar day as written in the RFP, in the RFP's own time zone.
- The Questions tag is kept as its own value (`due`, `not_allowed`, `not_stated`), never inferred from whether a date exists.
- If the RFP gives a time but no time zone, show it and mark it "time zone not stated."

## Failure handling

- The profile exists before any AI or Drive work, so nothing is lost if a step fails.
- If the names can't be found, use the file name and flag it on the profile.
- Each step fails on its own with a retry: e.g. "Drive folder not created · Retry", "Review failed · Run again".

## File format

- Accept PDF (best) and Word (.docx), up to 50 MB. Word files are read as text; they are not converted to PDF, because the conversion can't run in a background function. Anything else is refused with a clear message.
- The browser checks a PDF before upload (pdf.js, loaded on demand): a password-protected PDF is refused with a clear message; a scanned PDF (almost no text on its first pages) is accepted with the note "Scanned document: double-check dates and figures." The note is stored on the RFP (`upload_note`) and shown on the profile. If the check can't read a file for any other reason, the upload goes ahead.
- Send PDFs to the Claude API as documents (text and page images). An RFP plus addenda go in one request, each labeled.

## Loading and retry

- The first fit review starts on its own once the file is in Drive (the sync function starts it). If that doesn't happen, the fit card shows **Run fit review**.
- A progress strip shows the four jobs (RFP saved · Client and RFP name · Drive folder · Dates and fit review) until all are done. A failed name-reading or Drive job has its own **Retry**; a failed review is run again from the fit card.

## Decisions beyond the first draft

Agreed while building. Keep unless changed.

- **Owner.** Each RFP has an owner (starts as whoever added it; **Change owner** in the ⋯ menu). Shown under the title.
- **⋯ menu.** Run review again (asks first, only once a review exists), Replace RFP file, Edit details, Change owner, Delete RFP; **Reopen** replaces the first two on a closed RFP. The red Delete card at the bottom stays as well.
- **Replace RFP file.** The old file goes to the Drive trash after the new one is in Drive, and the row is removed. Title and client are kept; dates and budget are read again except ones the team typed. No new review starts by itself.
- **Reopen** puts a passed RFP back at the step it was passed from, moves its folder out of `_DEAD Opportunities` (only if it was moved), and adds a "reopen" line to the decision record.
- **Step sections.** Evaluate is a folded section once the RFP moves on, with a one-line summary: score, band and the latest decision. Later steps show a plain "not built yet" placeholder until they are.

- **One Drive folder per client**, named with the client name only, directly under Prospective Clients. A client with an existing folder (matched on the name ignoring case, punctuation, "the" and "&"; helper folders starting with `_` are skipped) reuses it. The RFP file goes straight into the client folder, with no subfolders. Two simultaneous uploads for a brand-new client could create two folders; merge them by hand.
- **Pass moves the client's folder to `_DEAD Opportunities`** only when no other open RFP uses it. Delete with "move to trash" trashes the whole folder only when this is the client's last RFP; otherwise only this RFP's files.
- **The RFP list** has columns RFP (client above the title), Next step (the next date that needs someone, with its day count: the questions deadline while it is ahead, then the proposal deadline, then the expected decision once submitted), Fit ("7/12 · Conditional Go") and Status.
- **The RFP list has filters**: Active (default), Won, Lost, Passed, All, each with a count.
- **Colors:** the band pill, the total and each dimension score use a traffic-light scale. Green, yellow, orange and red for Definite Go, Conditional Go, Likely No-Go and Definite No-Go.
- **Rubric automatic no-go:** when the rubric's automatic no-go applies (budget scores 0 for unrealistic budget or free spec work), a line of red text under the verdict gives the reason. There is no separate tag.
