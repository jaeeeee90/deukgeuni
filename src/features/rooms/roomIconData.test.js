import assert from 'node:assert/strict'
import test from 'node:test'
import { roomIconOptions } from './roomData.js'

test('maps each legacy room icon value to a dog image asset', () => {
  assert.deepEqual(roomIconOptions.map(({ symbol, color, assetName }) => ({ symbol, color, assetName })), [
    { symbol: '💪', color: 'peach', assetName: 'bench-press-dog.png' },
    { symbol: '🏋️', color: 'lavender', assetName: 'lat-pulldown-dog.png' },
    { symbol: '🏃', color: 'mint', assetName: 'treadmill-dog.png' },
    { symbol: '🚴', color: 'peach', assetName: 'dumbbell-dog.png' },
    { symbol: '🧘', color: 'lavender', assetName: 'squat-dog.png' },
    { symbol: '🥊', color: 'mint', assetName: 'gymnastics-dog.png' },
  ])
})
