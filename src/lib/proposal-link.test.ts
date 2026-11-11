import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classifyLink, fileIdFromUrl, normalizeName, pickPdf, type DriveFile } from './proposal-link.ts'

const ID = '1tFzaqC8C9TPmrxYEqEDnnizOWwa2SxdrLmg8dJGck0E'
const pdf = (id: string, name: string): DriveFile => ({ id, name, mimeType: 'application/pdf' })

test('the file id comes out of the links the tracker holds', () => {
  assert.equal(fileIdFromUrl(`https://docs.google.com/document/d/${ID}/edit?tab=t.0`), ID)
  assert.equal(fileIdFromUrl(`https://drive.google.com/file/d/${ID}/view?usp=sharing`), ID)
  assert.equal(fileIdFromUrl(`https://drive.google.com/open?id=${ID}`), ID)
  assert.equal(fileIdFromUrl('https://example.com/nothing'), null)
  assert.equal(fileIdFromUrl(null), null)
  assert.equal(fileIdFromUrl(''), null)
})

test('names are compared without extension, case, spacing or punctuation', () => {
  assert.equal(normalizeName('Home of the Innocents + Fieldtrip.pdf'), 'home of the innocents fieldtrip')
  assert.equal(normalizeName('  home OF the   innocents - fieldtrip '), 'home of the innocents fieldtrip')
})

test('the PDF beside a Doc is the one with the same name', () => {
  const siblings = [pdf('a', 'Other Proposal.pdf'), pdf('b', 'Dare to Care + Fieldtrip.pdf'), { id: 'c', name: 'Dare to Care + Fieldtrip', mimeType: 'application/vnd.google-apps.document' }]
  assert.equal(pickPdf('Dare to Care + Fieldtrip', siblings), 'b')
})

test('a PDF whose name only starts with the Doc\'s counts when it is the only one', () => {
  assert.equal(pickPdf('Madison Metro School District + Fieldtrip', [pdf('a', 'Madison Metro School District + Fieldtrip FINAL.pdf')]), 'a')
  assert.equal(pickPdf('Madison Metro School District + Fieldtrip', [pdf('a', 'Madison Metro School District + Fieldtrip FINAL.pdf'), pdf('b', 'Madison Metro School District + Fieldtrip v2.pdf')]), null)
})

test('no PDF, a short name or no name gives nothing', () => {
  assert.equal(pickPdf('Dare to Care + Fieldtrip', []), null)
  assert.equal(pickPdf('Short', [pdf('a', 'Short Story.pdf')]), null)
  assert.equal(pickPdf('', [pdf('a', 'x.pdf')]), null)
})

test('a link is linked, can\'t be opened, not a Doc, or missing', () => {
  const url = `https://docs.google.com/document/d/${ID}/edit`
  assert.equal(classifyLink(url, { ok: true, mimeType: 'application/vnd.google-apps.document', trashed: false }), 'linked')
  assert.equal(classifyLink(url, { ok: true, mimeType: 'application/pdf', trashed: false }), 'not_a_doc')
  assert.equal(classifyLink(url, { ok: false, status: 404 }), 'no_access')
  assert.equal(classifyLink(url, { ok: true, mimeType: 'application/vnd.google-apps.document', trashed: true }), 'no_access')
  assert.equal(classifyLink(null, null), 'no_link')
  assert.equal(classifyLink('https://example.com', null), 'no_link')
})
