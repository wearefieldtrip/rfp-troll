// Sends one clearly marked TEST message to the team's Slack channel, built the same way as the real notice.
//   SLACK_WEBHOOK_URL=<the webhook> node --experimental-strip-types scripts/slack-test.mjs
// Without SLACK_WEBHOOK_URL it only prints the message. Set APP_URL to see the real link.
import { newRfpMessage } from '../src/lib/slack-message.ts'

const text =
  '*[TEST – please ignore]*\n' +
  newRfpMessage({
    title: 'Sample RFP: Website and communications services',
    clientName: 'Sample Client',
    services: ['Website', 'Brand strategy', 'Content & copy'],
    description: 'A sample description of what the issuer is asking for.',
    dates: {
      questions_policy: 'due',
      proposal_due_at: '2027-01-08T22:00:00.000Z', proposal_due_has_time: true, proposal_due_tz: 'America/New_York', proposal_due_text: '',
      questions_due_at: '2026-12-09T22:00:00.000Z', questions_due_has_time: true, questions_due_tz: 'America/New_York', questions_due_text: '',
      vendor_selection_at: null, vendor_selection_has_time: false, vendor_selection_tz: null, vendor_selection_text: null,
    },
    appUrl: process.env.APP_URL ?? null,
    rfpId: 'test',
  })

console.log(text + '\n')
const url = process.env.SLACK_WEBHOOK_URL
if (!url) {
  console.log('SLACK_WEBHOOK_URL is not set, so nothing was sent.')
} else {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
  console.log(res.ok ? 'Sent.' : `Slack answered ${res.status}.`)
}
