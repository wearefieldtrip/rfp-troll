import assert from 'node:assert/strict'
import { test } from 'node:test'
import { safeReturnPath } from './return-to.ts'

test('a page inside the app is kept, with its query and hash', () => {
  assert.equal(safeReturnPath('/rfps/abc'), '/rfps/abc')
  assert.equal(safeReturnPath('/rfps/abc?tab=1#history'), '/rfps/abc?tab=1#history')
})

test('addresses on other sites and the sign-in page are never returned to', () => {
  for (const bad of ['//evil.example.com', 'https://evil.example.com/x', '/\\evil.example.com', '/login', '/login?x=1', '/', '', null, undefined]) {
    assert.equal(safeReturnPath(bad as string | null | undefined), null, String(bad))
  }
})
