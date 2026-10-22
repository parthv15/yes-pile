import { useEffect, useRef, useState } from 'react'
import { photoUrl, type Photo } from '../db'
import StickyNotes from './StickyNotes'
import type { NoteDraft } from './NoteEditor'

interface Props {
  photo: Photo
  active: boolean
  present: boolean
  placing?: boolean
  onClick: () => void
  onPlace?: (position: { x: number; y: number }) => void
  onEdit?: (draft: NoteDraft) => void
}

/** The overlay shares the exact rendered image bounds, including portrait/landscape fitting. */
export default function ReviewPhoto({ photo, active, present, placing, onClick, onPlace, onEdit }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const [bounds, setBounds] = useState({ width: 0, height: 0 })
  const [natural, setNatural] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setBounds({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(container.current!)
    return () => observer.disconnect()
  }, [])
  const scale = natural.width ? Math.min(1, bounds.width / natural.width, bounds.height / natural.height) : 0
  return <div ref={container} className="flex h-full w-full items-center justify-center">
    <div className="photo-surface relative shrink-0" data-review-surface={active ? 'current' : 'neighbor'} style={{ width: natural.width * scale, height: natural.height * scale }}>
      <img src={photoUrl(photo, 'full')} alt={photo.name} draggable={false}
        onLoad={(e) => setNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
        onClick={(e) => {
          if (active && placing && onPlace) {
            const box = e.currentTarget.getBoundingClientRect()
            onPlace({ x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height })
          } else onClick()
        }}
        title={active ? placing ? 'Click to place a note' : 'Full screen (F)' : 'View photo'}
        className={`h-full w-full rounded-2xl object-contain shadow-xl ${present ? 'pointer-events-auto' : ''} ${active ? placing ? 'cursor-crosshair ring-2 ring-amber-400' : 'cursor-zoom-in' : 'cursor-pointer'}`} />
      <StickyNotes photo={photo} onEdit={active && present && !placing ? onEdit : undefined} />
    </div>
  </div>
}
