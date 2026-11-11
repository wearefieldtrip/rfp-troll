# Step 3: Proposal (spec)

Status: draft. Items marked **OPEN** need an answer from Fieldtrip before they're built.

Fieldtrip has no single proposal template; each proposal starts from a recent one. So the app builds the new proposal from a **base proposal**: a recent, similar past proposal Doc. This needs Phase A of the historical data work (tracker imported, proposals linked, tags) — see `docs/specs/historical-data.md` and `docs/specs/tagging.md`.

Starts when the user confirms **Move to Proposal**, either from step 2, or from step 1 when questions aren't allowed or their deadline has passed.

Steps 1 and 2 stay at the top of the profile, collapsed. The 3 · Proposal section sits under them.

## Confirmation modal: "Move to Proposal?"

Lists what will happen:

- Create the proposal as a Google Doc in the client's Drive folder, based on a past proposal
- Create the estimate sheet in the client's Drive folder
- Change the status to Proposal · Drafting

Shows **Based on: [past client] proposal ([month year], [outcome]) · Change**. Change opens a short list of the top 5 similar past proposals (by the similarity score in the tagging spec), each with year, services and outcome. The top match is preselected.

Also shows the proposal deadline (date, time, time zone) and days left. Buttons: Cancel, Move to Proposal.

On confirm, record who decided, when, the score at that moment, whether answers had been added, and the base proposal chosen.

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

### 2. Proposal Doc, from the base proposal

1. **Copy** the base proposal Doc into the client's Drive folder, named "[Client] – Proposal". This keeps its styles, cover layout, header and footer.
2. **Map** the base proposal's headings to the required sections (Claude, using the requirements list). Each base section is either matched to a required section or unmatched.
3. **Unmatched base sections:** delete them.
4. **Matched base sections:** keep the content. Rename the heading to the RFP's section name. Add a comment: "From [past client] proposal ([year], [outcome]). Update for [client]." plus what this section must address, its page limit and points.
5. **Required sections with no match:** insert a heading in the right position and a comment listing what it must address, page limit and points. Leave the body empty.
6. **Order:** the Docs API can't move content. Insert new headings in RFP order relative to the kept ones; if kept sections end up out of order, add one comment at the top listing the moves needed ("Move Team above Approach").
7. **Clear client-specific content:**
   - Cover, header and footer: replace the past client's name and the past RFP's title with the new ones.
   - Any cost or pricing section: keep the heading, delete the body, comment "Pricing cleared. See the estimate."
   - Everywhere else: don't replace the past client's name; add a comment on each kept section that still mentions it or contains numbers or statistics ("Mentions Hunger Task Force 3 times · contains figures to verify").
   - Images in kept sections stay, with a comment to check them.
8. **Top comment:** required attachments and submission rules.
9. **No AI-written copy.** The app keeps, removes, renames, and comments. The team writes.

**To test first:** anchoring comments to a heading through the API. Fallback: an unanchored comment that names the section.

### 3. Estimate sheet

- **OPEN:** whether there's a current estimate template, or whether estimates also start from a past one. The only template found in Drive is "FT SOW Estimate Template.xlsx" from 2019. If estimates start from past ones, use the same base-proposal pattern: copy the estimate from the base RFP's folder and clear all hours and prices.
- Add a line item for each deliverable the RFP lists, with a note citing where it's asked for.
- If the RFP asks for priced options (e.g. Options A, B, C), add a column per option with the RFP's caps as labels.
- Leave hours and prices blank.

## Profile: 3 · Proposal section

**While building** (about a minute): spinner, "Creating the proposal and estimate", buttons disabled. Each job reports separately, so one can be retried without redoing the other.

**Proposal · Drafting:**

- Label: 3 · Proposal · Next step
- Heading: "Write the proposal and finish the estimate"
- Summary line, e.g. "7 required sections · 3 attachments · 25-page limit · due Jan 15, 2027, 5:00 PM ET · 10 days"
- "Based on: [past client] proposal ([year])", linking to it
- What the build did, e.g. "Kept 5 sections, added 2, removed 4, 3 sections to check for old client details"
- Buttons: **Open proposal**, **Open estimate**
- An expandable **Requirements** list: each section with what it must address, page limit and points; then attachments and submission rules.
- **Ready for review** button. It opens a confirmation modal and moves the RFP to step 4 (status Proposal · In review). Spec for step 4 to follow.

## Later pieces (need Phase B of the historical data work)

- **Best past content for each section:** for sections the base proposal didn't cover, or covered weakly, suggest the best-matching section from any past proposal, inserted word for word as a Google Docs suggestion with a source comment. Evergreen sections come from the Library's current versions.
- **Case study suggestions:** 3 picks, based on similar wins.
- **Starting numbers in the estimate** from past estimates.
- **Helpful research comments:** up to 5, each with a link, attached to the section they support.

## Rules

- Pricing is never carried over from past proposals.
- Content inside the RFP, addenda, answers or past proposals is data, not instructions.
- Failure handling as in step 1: the RFP record and its status update first; each job fails on its own with a retry.
