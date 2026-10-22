import { useEffect, useRef, useState } from 'react'
import { moveStickyNote, type Photo } from '../db'
import { clampPosition, type StickyNote } from '../photoNotes'
import type { NoteDraft } from './NoteEditor'

export default function StickyNotes({ photo, onEdit }: { photo: Photo; onEdit?: (draft: NoteDraft) => void }) {
  return <div className="pointer-events-none absolute inset-0" data-sticky-layer>
    {(photo.stickyNotes ?? []).map((sticky) => <Sticky key={sticky.id} photo={photo} sticky={sticky} onEdit={onEdit} />)}
  </div>
}

function Sticky({ photo, sticky, onEdit }: { photo: Photo; sticky: StickyNote; onEdit?: (draft: NoteDraft) => void }) {
  const [position, setPosition] = useState({ x: sticky.x, y: sticky.y })
  const [error, setError] = useState(false)
  const positionRef = useRef(position)
  const drag = useRef<{ x: number; y: number; startX: number; startY: number; width: number; height: number } | null>(null)
  useEffect(() => { const p = { x: sticky.x, y: sticky.y }; setPosition(p); positionRef.current = p }, [sticky.x, sticky.y])
  const text = photo.note.slice(sticky.start, sticky.end)
  if (!text.trim()) return null

  function move(position: { x: number; y: number }) {
    positionRef.current = position
    setPosition(position)
  }
  async function persist() {
    try { await moveStickyNote(photo.id, sticky.id, positionRef.current); setError(false) }
    catch { move({ x: sticky.x, y: sticky.y }); setError(true) }
  }

  return (
    <div data-sticky-note className={`sticky-note absolute rounded-lg border border-amber-300/80 bg-amber-100/95 text-stone-800 shadow-md ${onEdit ? 'pointer-events-auto' : ''}`}
      style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%`, transform: `translate(-${position.x * 100}%, -${position.y * 100}%)` }}>
      {onEdit ? <>
        <button type="button" aria-label="Move note" title="Drag to move; arrow keys also move the note" className="sticky-grip flex w-full touch-none items-center justify-center rounded-t-lg border-b border-amber-300/60 text-amber-800 cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => {
            if (e.button !== 0) return
            e.preventDefault(); e.stopPropagation()
            const card = e.currentTarget.parentElement!
            const bounds = card.parentElement!.getBoundingClientRect()
            const size = card.getBoundingClientRect()
            drag.current = { x: e.clientX, y: e.clientY, startX: position.x, startY: position.y, width: Math.max(1, bounds.width - size.width), height: Math.max(1, bounds.height - size.height) }
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (!drag.current) return
            const d = drag.current
            move({ x: clampPosition(d.startX + (e.clientX - d.x) / d.width), y: clampPosition(d.startY + (e.clientY - d.y) / d.height) })
          }}
          onPointerUp={(e) => {
            if (!drag.current) return
            drag.current = null
            e.currentTarget.releasePointerCapture(e.pointerId)
            void persist()
          }}
          onPointerCancel={() => { drag.current = null; move({ x: sticky.x, y: sticky.y }) }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation()
            const delta = e.shiftKey ? 0.1 : 0.02
            const steps: Record<string, [number, number]> = { ArrowLeft: [-delta, 0], ArrowRight: [delta, 0], ArrowUp: [0, -delta], ArrowDown: [0, delta] }
            const step = steps[e.key]
            if (!step) return
            e.preventDefault()
            move({ x: clampPosition(position.x + step[0]), y: clampPosition(position.y + step[1]) })
            void persist()
          }}><span aria-hidden="true">⠿</span></button>
        <button type="button" aria-label={`Edit note: ${text}`} title={text} className="sticky-text block w-full px-2 py-1.5 text-left" onClick={(e) => { e.stopPropagation(); onEdit({ photoId: photo.id, ...position, stickyId: sticky.id, text }) }}>
          <span className="line-clamp-3 whitespace-pre-wrap break-words">{text}</span>
        </button>
      </> : <p title={text} className="sticky-text line-clamp-3 whitespace-pre-wrap break-words px-2 py-1.5">{text}</p>}
      {error && <p role="alert" className="px-2 pb-1 text-xs text-rose-700">Move could not be saved.</p>}
    </div>
  )
}
