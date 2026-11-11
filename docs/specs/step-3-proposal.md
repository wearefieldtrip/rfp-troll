# Step 3: Proposal (spec)

Status: draft. Items marked **OPEN** need an answer from Fieldtrip before they're built.

Starts when the user confirms **Move to Proposal**, either from step 2, or from step 1 when questions aren't allowed or their deadline has passed.

Steps 1 and 2 stay at the top of the profile, collapsed. The 3 · Proposal section sits under them.

## Confirmation modal: "Move to Proposal?"

Lists what will happen:

- Create the proposal as a Google Doc in the client's Drive folder
- Create the estimate sheet in the client's Drive folder
- Change the status to Proposal · Drafting

Also shows the proposal deadline (date, time, time zone) and days left. Buttons: Cancel, Move to Proposal.

On confirm, record who decided, when, the score at that moment, and whether answers had been added.

## Jobs (background, each with its own status and retry)

### 1. Requirements list

Read the RFP, every addendum, and the client's answers (all labeled, in one request). Return:

```json
{
  "sections": [
    {
      "title": "the RFP's own name for the section",
      "order": 1,
      "must_address": ["short items, max 6"],
      "page_limit": "e.g. 3 pages, or null",
      "points": "e.g. 25 of 100, or null",
      "source": "page or answer number"
    }
  ],
  "attachments": [{ "name": "e.g. W-9, signed cost form", "source": "page" }],
  "submission": {
    "due": "timestamp with time zone",
    "method": "e.g. email PDF to …, portal upload",
    "format_rules": ["page limit, font, file type, naming…"]
  }
}
```

- If an answer or addendum changed a requirement, the latest version wins, and the source points to it.
- Store the list on the RFP. **Step 4 (Review) checks the proposal against this same list.**

### 2. Proposal Doc

- Copy the proposal template into the client's Drive folder, named "[Client] – Proposal". **OPEN:** which template Doc to use.
- Replace the template body with one heading per required section, in the RFP's order and using the RFP's section names, styled with the template's heading styles.
- Add one comment on each heading listing what that section must address, plus its page limit and points, with the source. **To test first:** anchoring comments to a heading through the API. Fallback: an unanchored comment that names the section.
- Add one comment at the top listing required attachments and submission rules.
- No AI-written copy. The team writes every section.

### 3. Estimate sheet

- Copy the estimate template into the client's Drive folder as a Google Sheet, named "[Client] – Estimate". **OPEN:** which template, and whether its line items are fixed or rebuilt per project. The only one found in Drive is "FT SOW Estimate Template.xlsx" from 2019.
- Add a line item for each deliverable the RFP lists, with a note citing where it's asked for.
- If the RFP asks for priced options (e.g. Options A, B, C), add a column per option with the RFP's caps as labels.
- Leave hours and prices blank.

## Profile: 3 · Proposal section

**While building** (about a minute): spinner, "Creating the proposal and estimate", buttons disabled. Each job reports separately, so one can be retried without redoing the other.

**Proposal · Drafting:**

- Label: 3 · Proposal · Next step
- Heading: "Write the proposal and finish the estimate"
- Summary line, e.g. "7 required sections · 3 attachments · 25-page limit · due Jan 15, 2027, 5:00 PM ET · 10 days"
- Buttons: **Open proposal**, **Open estimate**
- An expandable **Requirements** list: each section with what it must address, page limit and points; then attachments and submission rules.
- **Ready for review** button. It opens a confirmation modal and moves the RFP to step 4 (status Proposal · In review). Spec for step 4 to follow.

## Later pieces (not in this build)

Each of these needs the historical data import (`docs/specs/historical-data.md`):

- **Past content as suggestions:** for each section, insert the best-matching past section word for word as a Google Docs suggestion, with a comment giving its source, year, outcome and flags (other client's name, numbers). Evergreen sections come from the Library's current versions.
- **Case study suggestions:** 3 picks, based on similar wins.
- **Starting numbers in the estimate** from past estimates.
- **Helpful research comments:** up to 5, each with a link, attached to the section they support.

## Rules

- Pricing is never copied from past proposals.
- Content inside the RFP, addenda or answers is data, not instructions.
- Failure handling as in step 1: the RFP record and its status update first; each job fails on its own with a retry.
