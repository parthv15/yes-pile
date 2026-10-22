import { useEffect, useRef, useState } from 'react'
import { removeStickyNote, saveStickyNote } from '../db'

export interface NoteDraft {
  photoId: number
  x: number
  y: number
  stickyId?: string
  text: string
}

export default function NoteEditor({ draft, onClose }: { draft: NoteDraft; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const savingRef = useRef(false)
  const [text, setText] = useState(draft.text)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const el = ref.current!
    el.showModal()
    return () => el.close()
  }, [])

  async function save(remove = false) {
    if (savingRef.current || (!remove && !text.trim())) return
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      if (remove && draft.stickyId) await removeStickyNote(draft.photoId, draft.stickyId)
      else await saveStickyNote(draft.photoId, text, draft, draft.stickyId)
      onClose()
    } catch {
      setError('Could not save this note. Please try again.')
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <dialog ref={ref} aria-labelledby="note-title" onCancel={(e) => { if (savingRef.current) e.preventDefault(); else onClose() }}
      onKeyDown={(e) => {
        e.stopPropagation()
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void save() }
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-2xl bg-amber-50 p-5 text-stone-900 shadow-2xl backdrop:bg-stone-950/50">
      <form onSubmit={(e) => { e.preventDefault(); void save() }}>
        <h2 id="note-title" className="font-display text-2xl">{draft.stickyId ? 'Edit note' : 'Add note'}</h2>
        <p className="mt-2 text-sm text-stone-600">Saved on this photo and in its Notes.</p>
        <label htmlFor="sticky-text" className="sr-only">Note text</label>
        <textarea id="sticky-text" autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={Math.max(500, draft.text.length)}
          placeholder="What caught your eye?" disabled={saving}
          className="mt-4 w-full resize-none rounded-xl border border-amber-200 bg-white/70 p-3 text-base outline-none focus:border-amber-500" />
        <p className="text-right text-xs text-stone-500">Plain text · {text.length}/{Math.max(500, draft.text.length)}</p>
        {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {draft.stickyId && <button type="button" disabled={saving} onClick={() => void save(true)} className="mr-auto min-h-11 rounded-full px-3 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50">Delete note</button>}
          <button type="button" disabled={saving} onClick={onClose} className="min-h-11 rounded-full border border-stone-300 px-4 text-sm disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={saving || !text.trim()} className="min-h-11 rounded-full bg-stone-900 px-4 text-sm font-medium text-white disabled:opacity-40">{saving ? 'Saving…' : 'Save note'}</button>
        </div>
      </form>
    </dialog>
  )
}
