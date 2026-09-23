import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeExplanationRefresh } from '../src/explanationRefresh.js'
const confirmed = [{ event_id: 'A', score: 5, rank: 1, factors: { level: 2 }, explanation: 'Rules', explanation_source: 'rules' }]
test('refresh applies only wording to the exact confirmed recommendation facts', () => {
  const updated = [{ ...confirmed[0], explanation: 'Verified facts', explanation_source: 'ai' }]
  assert.deepEqual(mergeExplanationRefresh(confirmed, updated), updated)
  assert.equal(confirmed[0].explanation, 'Rules')
})
test('stale progress, ranking, and different event responses cannot replace confirmed state', () => {
  for (const change of [{ event_id: 'B' }, { score: 99 }, { factors: { level: 1 } }, { rank: 2 }]) {
    assert.equal(mergeExplanationRefresh(confirmed, [{ ...confirmed[0], ...change }]), confirmed)
  }
  assert.equal(mergeExplanationRefresh(confirmed, []), confirmed)
})
