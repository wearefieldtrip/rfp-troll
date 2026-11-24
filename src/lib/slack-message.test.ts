import assert from 'node:assert/strict'
import { test } from 'node:test'
import { newRfpMessage } from './slack-message.ts'

const base = { title: 'Brand refresh', clientName: 'Riverbend', services: ['Brand strategy', 'Website'], description: 'A regional food bank wants a new brand and website.', appUrl: 'https://troll.example.org/', rfpId: 'abc' }

test('the message names the RFP, services, description and a link', () => {
  assert.equal(
    newRfpMessage(base),
    '*There is a new RFP to view*\n*Brand refresh* · Riverbend\nServices asked for: Brand strategy, Website\nA regional food bank wants a new brand and website.\n<https://troll.example.org/rfps/abc|Open in RFP Troll>',
  )
})

test('pieces that are missing are left out', () => {
  const text = newRfpMessage({ ...base, clientName: null, services: [], description: null, appUrl: null })
  assert.equal(text, '*There is a new RFP to view*\n*Brand refresh*')
})

test('Slack markup in the RFP\'s own words is escaped', () => {
  const text = newRfpMessage({ ...base, title: 'A <b> & C', description: 'See <!channel> now' })
  assert.match(text, /A &lt;b&gt; &amp; C/)
  assert.match(text, /See &lt;!channel&gt; now/)
  assert.doesNotMatch(text, /<!channel>/)
})

const dates = {
  questions_policy: 'due',
  proposal_due_at: '2027-01-08T22:00:00.000Z',
  proposal_due_has_time: true,
  proposal_due_tz: 'America/New_York',
  proposal_due_text: '',
  questions_due_at: '2026-12-09T12:00:00.000Z',
  questions_due_has_time: false,
  questions_due_tz: null,
  questions_due_text: '',
  vendor_selection_at: null,
  vendor_selection_has_time: false,
  vendor_selection_tz: null,
  vendor_selection_text: null,
}

test('key dates show their time and time zone when the RFP gives them, and say Not stated when it does not', () => {
  const text = newRfpMessage({ ...base, dates })
  assert.match(text, /\*Key dates\*\nProposal due: Jan 8, 2027, 5:00 PM ET\nQuestions due: Dec 9, 2026\nVendor selected: Not stated/)
  assert.ok(text.indexOf('Key dates') < text.indexOf('Open in RFP Troll'))
})

test('questions not allowed is not the same as not stated', () => {
  assert.match(newRfpMessage({ ...base, dates: { ...dates, questions_policy: 'not_allowed' } }), /Questions due: Not allowed/)
  assert.match(newRfpMessage({ ...base, dates: { ...dates, questions_policy: 'not_stated' } }), /Questions due: Not stated/)
})

test('a time with no time zone is marked as such', () => {
  const text = newRfpMessage({ ...base, dates: { ...dates, proposal_due_tz: null } })
  assert.match(text, /Proposal due: Jan 8, 2027, 10:00 PM \(time zone not stated\)/)
})
