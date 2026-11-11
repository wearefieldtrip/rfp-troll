# Tagging (spec)

Every RFP, new or past, gets the same tags. They drive "similar past RFPs": the track record in the fit review, the base proposal suggested in step 3, and later, past-content and case-study suggestions.

## Tag groups

| Group | Answers | Values per RFP | Starting values |
|---|---|---|---|
| Client type | Who the client is | One | Nonprofit · Civic / government · Education |
| Sector | What field they're in | One | K-12 · Higher ed · Transit · Parks & rec · Environmental / solid waste · Health · Youth & family · Housing · Arts & culture · Tourism · Research · Foundation · State agency |
| Services | What they want from us | Many | Brand strategy · Visual identity · Website · Campaign · Media planning & buying · Content & copy · Research & discovery · Social · Video & photo · Signage & wayfinding · Print & reports · Community outreach · Translation · Accessibility · Training · Ongoing support · Agency of record |
| Topic | What the work is about | Many | Grows over time, e.g. youth mental health · recycling · ridership · stormwater · fundraising · recruitment |
| Audience | Who it must reach | Many | Youth · Parents & families · Donors · Residents · Riders · Students · Spanish speakers · Employees |
| Budget band | How big it is | One | Under $50K · $50–100K · $100–250K · $250K+ · Not stated |
| Geography | Where it is | Automatic | State; Louisville/KY or out of state |
| Procurement | What kind of process | Automatic | RFP / RFI / RFQ · public or private · multi-year or AOR · pitch round · DBE/WBE preference |
| Requirements | What comes with it | Many | Bilingual · WCAG compliance · Media buy pass-through · Subcontractors allowed · Spec work requested · Insurance minimums |

- **Sector vs. topic:** sector describes the client, topic describes the work. Olmsted County is Civic / government, Environmental / solid waste, topic recycling.
- **Budget band** uses the stated budget; an estimate from a 990 doesn't set it (stays Not stated).
- **Outcome** (Won, Lost, Passed, plus reason and furthest stage) comes from the RFP's lifecycle. It isn't a tag.

## Rules

- **Fixed lists.** Values come from lists kept in the Library (Library → Tags). No free text.
- **Client type, sector, services, procurement and budget band change rarely.** Topic and audience grow.
- **The AI tags, a person confirms.** The fit review returns tags from the lists. The AI may suggest a new value (e.g. "wildfire prevention"); it's stored as *suggested* and only joins the list when someone approves it in the Library.
- **Editable on the profile.** Tags show as chips in a single row under the pills, with an Edit action. Edits are recorded (who, when) and re-run nothing.
- **Past RFPs get the same tags** (see backfill below).

## Fit review output

Add to the step 1 output:

```json
"tags": {
  "client_type": "Nonprofit",
  "sector": "Youth & family",
  "services": ["Brand strategy", "Visual identity", "Website", "Campaign", "Translation", "Accessibility"],
  "topics": ["youth mental health"],
  "audiences": ["Youth", "Parents & families", "Spanish speakers"],
  "requirements": ["Bilingual", "WCAG compliance"],
  "suggested_new": [{ "group": "topics", "value": "…" }]
}
```

Geography, procurement and budget band are filled from the extracted facts, not guessed separately.

## Storage (Supabase)

- `tag_values`: group, value, status (approved / suggested), created by, created at.
- `rfp_tags`: rfp, tag value, source (ai / person / import), confirmed (bool), updated by, updated at.

## Backfill from the tracker

| Tracker column | Tag |
|---|---|
| Client Type 1 | Client type (Civic → Civic / government) |
| Client Type 2 | Sector, mapped to the list (Solid Waste and Environmental → Environmental / solid waste; K12 → K-12). Values with no match go to Review imports. |
| Project Type | Services: Brand → Brand strategy + Visual identity; Brand + Website → adds Website; Brand + Marketing → adds Campaign; Campaign → Campaign; Website → Website; Marketing/AOR → Agency of record; Report → Print & reports; Signage → Signage & wayfinding |
| Document Type | Procurement: RFP / RFI / RFQ |
| State, Louisville/KY focus | Geography |

The AI then reads each linked proposal Doc to add services, topics, audiences and requirements the tracker doesn't hold. Everything it adds is unconfirmed until someone reviews it on the Review imports list.

## Similarity

Score each past RFP against the current one. Starting weights, tunable later:

| Signal | Weight |
|---|---|
| Services overlap (shared ÷ combined) | 4 |
| Same sector | 3 |
| Same client type | 2 |
| Topic overlap | 2 |
| Same or adjacent budget band | 1 |
| Recency | Multiply by 1.0 this year, 0.85 last year, 0.7 two years back, 0.5 older |

Use: top matches for the fit review's track record line, and the ranked list of base proposals in step 3 (only past RFPs with a linked proposal Doc).
