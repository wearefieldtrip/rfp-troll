# Step 2: Questions (spec)

Design reference: `docs/design/S1-Questions.dc.html`, `S2-Waiting.dc.html`, `S2-NoAnswers.dc.html`, `S2-Answers.dc.html`.

Step 1 stays at the top of the profile, collapsed. The 2 · Questions section sits under it and changes with the status.

## Questions · Drafting

Starts when the user confirms **Move to Questions**.

- Build the questions doc in the client's Drive folder (service account):
  1. Copy the questions template. Keep only the bank questions that fit this RFP (normal edits).
  2. In a second Docs API `batchUpdate` with `writeControl.writeMode: SUGGEST`, insert the fit review's questions as **suggestions**, each starting with "AI suggested question:".
  3. Check the response: document edits can save even if the suggestion part fails. If so, show "Suggestions not added · Retry".
- To test first: whether the service account can create suggestions, and how they're attributed.
- Open decision: keep the "AI suggested question:" label in the suggested text (and offer a Clean up action that strips it before sending), or put it in a comment on each suggestion.
- Possible: suggest removals of unrelated bank questions too, instead of deleting them, so the team can restore any.
- Card: "Review the questions doc and send it", what the doc contains (e.g. 23 bank questions plus 8 AI suggested), **Open questions doc**, **Mark as sent**, and "Send it to the client yourself, then click Mark as sent so we can track the reply."
- While building (under a minute): spinner, "Creating the questions doc", buttons disabled.

## Mark as sent

- Small confirmation modal asking for the date sent (defaults to today).
- Export the doc as it was sent to PDF in the client's Drive folder ("Questions sent – [date].pdf").
- Status becomes **Questions · Sent**.

## Questions · Sent (waiting)

- Card: "Waiting for answers", how many questions were sent and when, when answers are expected and days left (if the RFP gives that date).
- **Add answers** button, and a small **Decide without answers** link.
- Links: Questions as sent (PDF), Questions doc.
- If the expected date passes with nothing added, flag "Answers overdue" on the RFP list and suggest deciding without answers.

## Add answers

- Modal: upload a file (PDF or Word), or paste text. Date received (defaults to today). **Add answers** disabled until there's a file or text.
- Save the file to the client's Drive folder ("Answers – [date].pdf").
- Card shows "Reading the answers" with placeholders (about a minute).
- The AI:
  - matches answers to our questions; lists any of ours that weren't answered,
  - checks for changed facts. A changed deadline updates its pill and says so ("Proposal due Jan 22, 2027 · updated from Jan 15"),
  - re-scores the fit and names the rubric line that moved,
  - summarizes other agencies' questions: count and main themes.
- Answers can come in batches. After the first, **Add more answers** stays available; each batch shows only what it changed.

## Questions · Answers in (decision needed)

- Card: "Answers are in. Move to Proposal?", the new score with the old one struck through and which line moved, **Move to Proposal** and **Pass** (same confirmation modals as step 1).
- "What the answers changed": up to 3 points, each citing the answer number.
- "What other agencies asked": one or two sentences.
- Links: Answers (PDF), Questions as sent (PDF), Questions doc.

## Decide without answers

- No confirmation for the link itself; it only reveals the decision.
- Card: "No answers yet. Move to Proposal?", score unchanged and marked "Based on the RFP alone".
- "Still unanswered": the 2–3 open questions that matter most to the score, each tagged with its rubric line.
- **Move to Proposal**, **Pass** (with their modals) and a **Back to waiting** link.
- The decision record notes it was made without answers. Add answers stays available afterward.
