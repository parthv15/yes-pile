import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appendStickyNote, editStickyNote, deleteStickyNote, changePhotoNote } from '../src/photoNotes.ts'
const add = (state, text, id) => appendStickyNote(state, text, { x: 0.2, y: 0.7 }, id)
const texts = (state) => (state.stickyNotes ?? []).map((s) => state.note.slice(s.start, s.end))

test('append keeps existing notes verbatim and treats markup as plain text', () => {
  const original = { note: 'Vendor details\n$400 quote  ' }
  const result = add(original, '  <b>Love this</b>\nAsk for pink  ', 'a')
  assert.equal(result.note, 'Vendor details\n$400 quote  \n\n<b>Love this</b>\nAsk for pink')
  assert.deepEqual(texts(result), ['<b>Love this</b>\nAsk for pink'])
  assert.equal(original.note, 'Vendor details\n$400 quote  ')
  assert.equal(add(result, '  \n ', 'b').note, result.note)
})

test('editing one of several identical notes updates only its own text and shifts later pins', () => {
  let state = add(add(add({ note: 'Same' }, 'Same', 'a'), 'Same', 'b'), 'Last', 'c')
  state = editStickyNote(state, 'b', 'Different\nSecond line')
  assert.equal(state.note, 'Same\n\nSame\n\nDifferent\nSecond line\n\nLast')
  assert.deepEqual(texts(state), ['Same', 'Different\nSecond line', 'Last'])
  assert.deepEqual(state.stickyNotes.map(s => [s.x, s.y]), [[0.2, 0.7], [0.2, 0.7], [0.2, 0.7]])
})

test('deleting first, middle, and last stickies preserves other notes and their anchors', () => {
  const state = add(add(add({ note: '' }, 'First', 'a'), 'Middle', 'b'), 'Last', 'c')
  for (const [id, expected] of [['a', ['Middle', 'Last']], ['b', ['First', 'Last']], ['c', ['First', 'Middle']]]) {
    const result = deleteStickyNote(state, id)
    assert.equal(result.note, expected.join('\n\n'))
    assert.deepEqual(texts(result), expected)
  }
  const legacy = add({ note: 'First\n\nDo not delete me' }, 'First', 'a')
  assert.equal(deleteStickyNote(legacy, 'a').note, 'First\n\nDo not delete me')
})

test('ordinary Notes edits before and inside a sticky keep it attached to the right text', () => {
  let state = add(add({ note: 'Original' }, 'Small flowers', 'a'), 'Keep this', 'b')
  state = changePhotoNote(state, 'Added context\n' + state.note)
  assert.deepEqual(texts(state), ['Small flowers', 'Keep this'])
  state = changePhotoNote(state, state.note.replace('Small flowers', 'Small pink flowers'))
  assert.deepEqual(texts(state), ['Small pink flowers', 'Keep this'])
  state = changePhotoNote(state, state.note + '\nGeneral thought')
  assert.deepEqual(texts(state), ['Small pink flowers', 'Keep this'])
})

test('rewriting across note boundaries preserves new text without stale pins', () => {
  const state = add(add({ note: 'Context' }, 'First', 'a'), 'Second', 'b')
  const result = changePhotoNote(state, 'Completely rewritten notes')
  assert.equal(result.note, 'Completely rewritten notes')
  assert.deepEqual(result.stickyNotes, [])
  const cleared = changePhotoNote(state, '')
  assert.deepEqual(cleared, { note: '', stickyNotes: [] })
})

test('older photos need no metadata and positions stay within the photo', () => {
  assert.deepEqual(changePhotoNote({ note: 'Old note' }, 'New note'), { note: 'New note', stickyNotes: [] })
  const result = appendStickyNote({ note: '' }, 'Pinned', { x: -3, y: 8 }, 'a')
  assert.equal(result.stickyNotes[0].x, 0)
  assert.equal(result.stickyNotes[0].y, 1)
  assert.deepEqual(editStickyNote(result, 'missing', 'No'), result)
})
