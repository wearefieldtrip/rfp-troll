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
