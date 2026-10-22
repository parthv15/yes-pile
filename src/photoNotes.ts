/** Positions use the available space in the review area; ranges point into its plain notes. */
export interface StickyNote {
  id: string
  x: number
  y: number
  start: number
  end: number
}

interface NoteState {
  note: string
  stickyNotes?: StickyNote[]
}

export const clampPosition = (value: number) => Math.max(0, Math.min(1, value))

/** Keep annotations anchored when the ordinary Notes field is edited. */
export function changePhotoNote(photo: NoteState, note: string): NoteState {
  const old = photo.note
  if (old === note) return { note, stickyNotes: photo.stickyNotes }
  let start = 0
  while (start < old.length && start < note.length && old[start] === note[start]) start++
  let end = old.length
  let newEnd = note.length
  while (end > start && newEnd > start && old[end - 1] === note[newEnd - 1]) { end--; newEnd-- }
  const delta = note.length - old.length
  const stickyNotes = (photo.stickyNotes ?? []).flatMap((sticky) => {
    if (sticky.end <= start) return [sticky]
    if (sticky.start >= end) return [{ ...sticky, start: sticky.start + delta, end: sticky.end + delta }]
    if (sticky.start <= start && sticky.end >= end) {
      const updated = { ...sticky, end: sticky.end + delta }
      return note.slice(updated.start, updated.end).trim() ? [updated] : []
    }
    // An edit spanning an annotation boundary keeps the text, but removes its obsolete pin.
    return []
  })
  return { note, stickyNotes }
}

export function appendStickyNote(photo: NoteState, text: string, position: { x: number; y: number }, id: string): NoteState {
  text = text.trim()
  if (!text) return { note: photo.note, stickyNotes: photo.stickyNotes }
  const prefix = photo.note + (photo.note ? '\n\n' : '')
  return {
    note: prefix + text,
    stickyNotes: [...(photo.stickyNotes ?? []), {
      id, x: clampPosition(position.x), y: clampPosition(position.y), start: prefix.length, end: prefix.length + text.length,
    }],
  }
}

export function editStickyNote(photo: NoteState, id: string, text: string): NoteState {
  const sticky = photo.stickyNotes?.find((s) => s.id === id)
  if (!sticky) return { note: photo.note, stickyNotes: photo.stickyNotes }
  text = text.trim()
  if (!text) return deleteStickyNote(photo, id)
  const delta = text.length - (sticky.end - sticky.start)
  return {
    note: photo.note.slice(0, sticky.start) + text + photo.note.slice(sticky.end),
    stickyNotes: photo.stickyNotes!.map((s) => s.id === id
      ? { ...s, end: s.start + text.length }
      : s.start >= sticky.end ? { ...s, start: s.start + delta, end: s.end + delta } : s),
  }
}

export function deleteStickyNote(photo: NoteState, id: string): NoteState {
  const sticky = photo.stickyNotes?.find((s) => s.id === id)
  if (!sticky) return { note: photo.note, stickyNotes: photo.stickyNotes }
  const start = photo.note.slice(Math.max(0, sticky.start - 2), sticky.start) === '\n\n' ? sticky.start - 2 : sticky.start
  const end = start === 0 && photo.note.slice(sticky.end, sticky.end + 2) === '\n\n' ? sticky.end + 2 : sticky.end
  const delta = end - start
  return {
    note: photo.note.slice(0, start) + photo.note.slice(end),
    stickyNotes: photo.stickyNotes!.filter((s) => s.id !== id).map((s) => s.start >= end
      ? { ...s, start: s.start - delta, end: s.end - delta } : s),
  }
}
