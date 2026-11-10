# Original brief

Fieldtrip's original description of the tool (lightly copyedited), kept for context. Where it differs from the specs in `docs/`, the specs win (e.g. proposals are Google Docs, not Slides; the app does not create pitch decks).

## Overview

The company I work for, Fieldtrip, would like to build an encompassing RFP tool that helps us from end to end answer RFPs to win new business. We are a marketing agency in Louisville, KY that works with non-profit, cause-driven and civic organizations. A large part of our yearly new business is searching for and responding to RFPs. Our current process is very tedious and takes us a large amount of hours (employee cost) to manage an RFP from beginning to end. So we would like to build an internal web application that dramatically cuts down on the number of hours needed. That said, we do not want this tool to take over completely. We still want our expertise and human touch to shine through. We want this tool to be a growing thing that has access to previous rfps that we have gone after (and decided to not go after), ones we have won and lost. We want it to understand our tone and index our content to be used in future rfps. Essentially we want it to have strong historical knowledge.

## Ideal Process

1a) When our team comes across an RFP that interests us, we would like to upload that RFP to the tool and have it provide a report on how suitable of a fit it is for us. We would provide a rubric to score on but also use historical data to also mix into the decision making process. Our team would then decide to either pass or move forward with the opportunity with the next step which is typically asking clarifying questions to the organization.

1b) Have the tool search for RFPs on the internet and suggest possible opportunities based on our rubric and historical knowledge that it believes would be a good fit.

2) If we decide to move forward, we will have a question bank that is stored in the tool. These are questions that we typically ask. The tool would pull relevant questions from the bank and also generate specific questions for the opportunity. The tool would label custom questions so our team knows that a new question is being asked and therefore can decide if we like it or not. The tool would then generate a Google Doc based on a template provided by Fieldtrip and insert the questions and provide a link to the question doc that the team can then review and edit. Once the team sends off the questions, the team will notify in the tool that questions have been sent. Once the answers are returned, the team has the option to feed the answers to the rfp in progress so the tool can be aware of any new information. Based on the answers to the questions, the team will decide on either moving forward with forming a proper proposal or passing and will notify in the app.

3) If the team decides to move forward with a proper proposal, the tool will do a couple of things. One it will create a google sheet estimation (based on a template) and use historical estimations to place starting numbers. It will also generate a google slide presentation and based on past presentations, build out an outline deck and place some content that we've used in previous proposals that it feels matches what the RFP is looking for. The tool will take into account how the client wants the presentation laid out. Once completed the team will take over and complete the presentation. We also want the tool to provide comments in the Google slide to resources/links/research it believes could help us provide a stronger presentation.

4) Once the team completes the presentation, we would want the tool to review our work and provide feedback (do not make edits, just suggestions) on anything that is weak or missing that the client is looking for. We would probably need the tool to do multiple reviews before considering it done. Once complete the team would then mark it complete and send it to the client.

5) Then we wait. We will see if we are invited to formally pitch (meaning we made the shortlist). We would inform the tool of the outcome of the opportunity.

## Considerations / Tech Stack

- This tool will need deep integration with our Google Workspace setup.
- We do not want it to generate any kind of creative or artistic work including imagery or illustrations.
- This is a private app for just our team who will sign in via their Google accounts from just our domain.
- This will be built using React/Vite/TypeScript.
- For any database work, we will use Supabase.
- We want the UI to be basic and clean and to use shadcn/ui.
