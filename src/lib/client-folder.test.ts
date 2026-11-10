import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findClientFolder, normalizeClientName } from './client-folder.ts'

const folder = (name: string, mimeType = 'application/vnd.google-apps.folder') => ({ id: name, name, mimeType })

test('names match ignoring case, punctuation, "the" and "&"', () => {
  assert.equal(normalizeClientName('The Smith Foundation, Inc.'), 'smith foundation inc')
  assert.equal(normalizeClientName('Arts & Parks'), normalizeClientName('arts and parks'))
})

test('an existing client folder is reused', () => {
  const found = findClientFolder([folder('Other Group'), folder('Smith Foundation')], 'The Smith Foundation')
  assert.equal(found?.id, 'Smith Foundation')
})

test('helper folders and files never match', () => {
  assert.equal(findClientFolder([folder('_DEAD Opportunities')], '_DEAD Opportunities'), null)
  assert.equal(findClientFolder([folder('Smith Foundation', 'application/pdf')], 'Smith Foundation'), null)
})

test('near matches are not reused', () => {
  assert.equal(findClientFolder([folder('Smith Foundation of Ohio')], 'Smith Foundation'), null)
})

test('an empty client name matches nothing', () => {
  assert.equal(findClientFolder([folder('')], '  '), null)
})
