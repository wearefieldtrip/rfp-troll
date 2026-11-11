# Step 2: Questions (spec)

Design reference: `docs/design/S1-Questions.dc.html`, `S2-Waiting.dc.html`, `S2-NoAnswers.dc.html`, `S2-Answers.dc.html`.

Step 1 stays at the top of the profile, collapsed. The 2 · Questions section sits under it and changes with the status. Once the RFP has moved past Questions (or been passed after the questions doc was made), the section stays as a folded line ("6 questions sent Nov 11 · answers added") that opens to what was sent, the answers and their links, with nothing left to decide.

## Questions · Drafting

Starts when the user confirms **Move to Questions**. The confirmation is the person starting this AI step.

- The `questions-doc` function builds the doc in the client's Drive folder (service account), named "Questions – [RFP title]":
  1. Copy the questions template (Google Doc "FT BD RFP IG Question Library Template", id in `QUESTIONS_TEMPLATE_DOC_ID`, default in the function). The template is a library: header lines, ~25 bullet questions (some with options or a table, kept with their question), then a "Guidelines:" section for the team.
  2. A small model (Haiku) reads the RFP and picks which library questions to keep. It only chooses; it never writes or rewrites a question. It drops questions the RFP already answers, ones that don't fit the work, and ones that name another client.
  3. Normal edits: cut the Guidelines and the dropped questions, fill the header (RFP title, today's date) and replace CLIENT with the client name. CONTACT is left for the team.
  4. A second `batchUpdate` with `writeControl.writeMode: SUGGEST` inserts the fit review's questions as **separate suggestions**, plus one doc-level comment saying so. Google merges suggestions that sit next to each other into one (tested 2026-11-11), so each question goes above a different library question (question 1 above library question 1, and so on; any beyond the library's count go at the end). That way the team can accept some and reject others. (Tested 2026-11-11: the service account can create suggestions and comments; Google doesn't reliably anchor comments made through the API, so there is one comment, not one per suggestion. Suggestions show the service account as their author.)
  5. Check the response for `createdSuggestionIds`: document edits can save even if the suggestion part fails. If so, show "Suggestions not added · Retry".
- Decision: the suggested text carries no "AI suggested question:" prefix. The suggestion's author and the comment mark them as AI.
- Card: "Review the questions doc and send it", what the doc contains (e.g. 11 template questions and 8 AI suggested questions), **Open questions doc**, **Mark as sent**, and "Send it to the client yourself, then click Mark as sent so we can track the reply."
- While building (under a minute): spinner, "Creating the questions doc", buttons disabled. A failure shows the reason and **Retry**, which clears the half-built doc and starts over.
- Stored on the RFP: doc id, doc status (building, ready, failed), suggestions status (added, failed), counts.

## Mark as sent

- Small confirmation modal asking for the date sent (defaults to today).
- Refused while any suggestion in the doc is still pending, so what is sent is final.
- No PDF is made. The Google Doc stays the record, linked from the card. The number of questions is counted from the doc at that moment. (The `questions_sent_pdf_id` column is unused.) When answers are read, the doc is turned into a PDF on the fly so the AI can see which questions were asked.
- Status becomes **Questions · Sent**.

## Questions · Sent (waiting)

- Card: "Waiting for answers", how many questions were sent and when. (Not built yet: when answers are expected and days left. The app doesn't read that date from the RFP.)
- **Add answers** button, and a small **Decide without answers** link.
- Links: Questions doc.
- Not built yet: flagging "Answers overdue" on the RFP list. It needs the expected-answers date above.

## Add answers

- Modal: upload a file (PDF or Word), or paste text. Date received (defaults to today). **Add answers** disabled until there's a file or text.
- Save the file to the client's Drive folder ("Answers – [RFP title] – [date]", keeping its PDF or Word extension). The batch is saved as a row before anything is read, so a failure never loses it; a failed reading shows its reason and **Retry** (it costs AI credit again). A reading that never finishes is treated as failed after 15 minutes.
- Card shows "Reading the answers" with placeholders (about a minute).
- The AI:
  - matches answers to our questions; lists any of ours that weren't answered,
  - checks for changed facts. A changed deadline updates its pill and says so ("Proposal due Jan 22, 2027 · updated from Jan 15"),
  - re-scores the fit and names the rubric line that moved. The re-score is saved as a new fit review, so the fit card, the decision record and the list all use it; what the answers left open becomes that review's questions,
  - summarizes other agencies' questions: count and main themes.
- Answers can come in batches. After the first, **Add more answers** stays available; each batch shows only what it changed.

## Questions · Answers in (decision needed)

- Card: "Answers are in. Move to Proposal?", the new score with the old one struck through and which line moved, **Move to Proposal** and **Pass** (same confirmation modals as step 1).
- "What the answers changed": up to 3 points, each citing the answer number.
- "What other agencies asked": one or two sentences.
- Links: Answers, Questions doc.

## Decide without answers

- No confirmation for the link itself; it only reveals the decision.
- Card: "No answers yet. Move to Proposal?", score unchanged and marked "Based on the RFP alone".
- "Still unanswered": the 2–3 open questions that matter most to the score, each tagged with its rubric line.
- **Move to Proposal**, **Pass** (with their modals) and a **Back to waiting** link.
- The decision record notes it was made without answers. Add answers stays available afterward.

## Built notes (2026-11-11)

- One function, `read-answers`, does the whole reading with the same Opus model and rubric as the fit review. The model supplies scores and words only; totals and bands are worked out by the app (`buildReview`).
- A changed proposal, questions or vendor-selection date, or a changed budget, replaces the old value (even one the team typed, because the issuer's answer is newer) and the card lists "updated from [old]".
- The fit review's questions now carry the rubric line each would affect (`question_lines`). **Decide without answers** uses those, lowest-scoring line first, so it needs no AI call. Reviews made before this have no tags and show without them.
- **Move to Proposal** from Questions is allowed in `decide_rfp` from Sent and Answers in, to Proposal only. Deciding without answers adds the note "Decided without answers from the issuer."
- Deleting an RFP also trashes its questions doc and answers files when the client folder is shared.
