import assert from 'node:assert/strict'
import { test } from 'node:test'
import { looksScanned } from './pdf-check.ts'

test('pages with real text are not scanned', () => {
  assert.equal(looksScanned([1200, 900, 1500]), false)
})

test('pages with almost no text are scanned', () => {
  assert.equal(looksScanned([0, 3, 12]), true)
})

test('no pages is not flagged', () => {
  assert.equal(looksScanned([]), false)
})
