import assert from 'node:assert/strict'
import { test } from 'node:test'
import { allDone, jobStates } from './progress.ts'

const states = (extract: string, drive: string, review: 'none' | 'running' | 'complete' | 'failed') =>
  jobStates({ extract_status: extract, drive_status: drive }, review).map((j) => j.state)

test('just uploaded: names are being read, the rest wait', () => {
  assert.deepEqual(states('pending', 'syncing', 'none'), ['done', 'active', 'waiting', 'waiting'])
})

test('names read: the folder is next', () => {
  assert.deepEqual(states('done', 'syncing', 'none'), ['done', 'done', 'active', 'waiting'])
})

test('everything finished', () => {
  const jobs = jobStates({ extract_status: 'done', drive_status: 'ready' }, 'complete')
  assert.equal(allDone(jobs), true)
})

test('failures show on their own job', () => {
  assert.deepEqual(states('failed', 'ready', 'running'), ['done', 'failed', 'done', 'active'])
  assert.deepEqual(states('done', 'failed', 'none'), ['done', 'done', 'failed', 'waiting'])
  assert.deepEqual(states('done', 'ready', 'failed'), ['done', 'done', 'done', 'failed'])
})
