# Design reference

Mockups of the RFP profile and its modals, exported from the design canvas. Use them for **layout, order, copy and states**. Build the real UI with the app's shadcn components and theme; don't copy the markup.

How to read the files:

- Each `.dc.html` file is one screen. The visible markup is inside `<x-dc>`; styles are inline.
- Ignore the `<script src="./support.js">` line, the `<x-dc>`/`<helmet>` wrappers, `<dc-import>` (it means "the screen named here sits behind this modal"), `<sc-if>`/`<sc-for>` (conditionals and loops) and the `<script type="text/x-dc">` block at the bottom. That block holds the sample data and the small interactions (expand/collapse, enabling a button).
- `{{name}}` is a value filled from that sample data.
- `ds/fieldtrip/tokens.css` is Fieldtrip's brand tokens (Inclusive Sans, brand colors). The app may use its own shadcn theme instead.
- All sample content is from a test RFP (Riverbend Youth Wellness Alliance). Some figures, page numbers and answer contents are illustrative.

| File | Screen |
|---|---|
| `S1-Modal.dc.html` | New RFP modal over the RFP list. One upload field; Add RFP disabled until a file is chosen |
| `S1-Loading.dc.html` | Profile right after Add RFP. Names filled in, progress strip, skeletons in the final layout |
| `S1-Ready.dc.html` | Profile, Evaluate · Ready for decision. Pills, "Check this" note, fit card with decision buttons and expandable rubric rows, top risks, questions to ask |
| `S1-Confirm-Forward.dc.html` | "Move to Questions?" confirmation |
| `S1-Confirm-Pass.dc.html` | "Pass on this RFP?" confirmation with required reason |
| `S1-Questions.dc.html` | After moving forward. Step 1 collapsed, step 2 card with Open questions doc / Mark as sent (`docReady` false shows the building state) |
| `S2-Waiting.dc.html` | Questions sent, waiting for answers |
| `S2-NoAnswers.dc.html` | Decide without answers |
| `S2-Answers.dc.html` | Answers in, decision needed |
