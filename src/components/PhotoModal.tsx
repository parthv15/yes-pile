import { useEffect, useState } from 'react'
import Lightbox from './Lightbox'
import { addToGroup, bringBack, createGroup, toggleGroup, deletePhotos, makeTheOne, passPhotos, photoUrl, savePhotoNote, updatePhoto, updateVerdicts, type Group, type Photo, type VerdictState } from '../db'
import { useDecision } from '../decision'

interface Props {
  photo: Photo
  groups: Group[]
  labels: string[]
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
}

export default function PhotoModal({ photo, groups, labels, onClose, onPrev, onNext }: Props) {
  const [labelDraft, setLabelDraft] = useState('')
  const [note, setNote] = useState(photo.note)
  const [fullscreen, setFullscreen] = useState(false)
  const { decision } = useDecision()

  useEffect(() => setNote(photo.note), [photo.id, photo.note])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') (e.target as HTMLElement).blur()
        return
      }
      if (e.key === 'Escape') onClose()
      else if (e.key === 'f') setFullscreen(true)
      else if (e.key === 'ArrowLeft') onPrev?.()
      else if (e.key === 'ArrowRight') onNext?.()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext])

  const judge = (changes: Partial<VerdictState>) => updateVerdicts(decision.id, [photo.id], changes)

  function addLabel(raw: string) {
    const label = raw.trim()
    if (label && !photo.labels.includes(label)) updatePhoto(photo.id, { labels: [...photo.labels, label] })
    setLabelDraft('')
  }

  async function newGroup() {
    const name = prompt('Name the new group')?.trim()
    if (name) await addToGroup(decision.id, [photo.id], await createGroup(decision.id, name))
  }

  const suggestions = labels.filter((l) => !photo.labels.includes(l))

  return (
    <div role="dialog" aria-modal="true" aria-label={`Photo details for ${photo.name}`}
      className="photo-modal fixed inset-0 z-40 flex flex-col overflow-y-auto bg-stone-950/85 backdrop-blur md:flex-row md:overflow-hidden" onClick={onClose}>
      <div className="relative flex h-[42dvh] min-h-52 min-w-0 shrink-0 items-center justify-center p-4 md:h-auto md:min-h-0 md:flex-1 md:p-10">
        <img
          src={photoUrl(photo, 'full')}
          alt={photo.name}
          className="max-h-full max-w-full cursor-zoom-in rounded-xl object-contain shadow-2xl"
          title="Full screen (F)"
          onClick={(e) => {
            e.stopPropagation()
            setFullscreen(true)
          }}
        />
        {onPrev && (
          <NavButton side="left" onClick={onPrev}>
            ‹
          </NavButton>
        )}
        {onNext && (
          <NavButton side="right" onClick={onNext}>
            ›
          </NavButton>
        )}
      </div>

      <aside
        className="photo-details flex w-full shrink-0 flex-col gap-5 bg-white p-5 md:w-96 md:gap-6 md:overflow-y-auto md:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <p className="min-w-0 truncate text-sm text-stone-500" title={photo.name}>
            {photo.name}
          </p>
          <button onClick={onClose} aria-label="Close photo details" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100">
            ✕
          </button>
        </div>

        {photo.batchName && (
          <section className="rounded-xl bg-stone-50 px-4 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400">Upload</h3>
            <p className="mt-1 break-words text-sm font-medium text-stone-800">{photo.batchName}</p>
          </section>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={() => (photo.theOne ? judge({ theOne: false }) : makeTheOne(decision.id, photo.id))}
            className={`rounded-xl py-4 font-display text-2xl font-bold transition ${
              photo.theOne ? 'bg-rose-500 text-white' : 'border-2 border-rose-500 text-rose-600 hover:bg-rose-50'
            }`}
          >
            {photo.theOne ? '❤️ THE ONE ❤️' : 'THE ONE!'}
          </button>
          <button
            onClick={() => judge({ yes: !photo.yes, out: false })}
            className={`rounded-xl py-3 font-medium transition ${
              photo.yes ? 'bg-stone-900 text-white' : 'border border-stone-300 hover:bg-stone-100'
            }`}
          >
            {photo.yes ? '✓ In the Yes Pile' : 'Add to Yes Pile'}
          </button>
        </div>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">Group</h3>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => toggleGroup(decision.id, photo, g.id)}
                className="min-h-11 max-w-full break-words rounded-full border px-3 py-1 text-sm"
                style={
                  photo.groupIds.includes(g.id)
                    ? { background: g.color, borderColor: g.color, color: 'white' }
                    : { borderColor: '#e7e5e4' }
                }
              >
                {g.name}
              </button>
            ))}
            <button onClick={newGroup} className="rounded-full px-3 py-1 text-sm text-stone-500 hover:bg-stone-100">
              + New
            </button>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">Labels</h3>
          <div className="flex flex-wrap gap-2">
            {photo.labels.map((l) => (
              <span key={l} className="flex items-center gap-1 rounded-full bg-stone-100 py-1 pr-2 pl-3 text-sm">
                {l}
                <button
                  onClick={() => updatePhoto(photo.id, { labels: photo.labels.filter((x) => x !== l) })}
                  className="text-stone-400 hover:text-stone-900"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          <form
            className="mt-2"
            onSubmit={(e) => {
              e.preventDefault()
              addLabel(labelDraft)
            }}
          >
            <input
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              placeholder="Add a label, press Enter"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900"
            />
          </form>
          {suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {suggestions.slice(0, 12).map((l) => (
                <button
                  key={l}
                  onClick={() => addLabel(l)}
                  className="rounded-full border border-dashed border-stone-300 px-2 py-0.5 text-xs text-stone-500 hover:border-stone-900 hover:text-stone-900"
                >
                  + {l}
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">Notes</h3>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== photo.note && savePhotoNote(photo.id, note)}
            rows={4}
            placeholder="Price, vendor contact, what you love about it…"
            className="w-full resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900"
          />
        </section>

        <div className="mt-auto flex flex-wrap gap-2 border-t border-stone-200 pt-4 text-sm">
          {photo.out ? (
            <button onClick={() => bringBack(decision.id, [photo.id])} className="rounded-full border border-stone-300 px-4 py-2 hover:bg-stone-100">
              Bring back
            </button>
          ) : (
            <button
              onClick={() => passPhotos(decision, [photo.id])}
              className="rounded-full border border-stone-300 px-4 py-2 hover:bg-stone-100"
            >
              Pass on this one
            </button>
          )}
          <button
            onClick={async () => {
              if (!confirm('Delete this photo for good?')) return
              onNext ? onNext() : onClose()
              await deletePhotos([photo.id])
            }}
            className="rounded-full px-4 py-2 text-rose-600 hover:bg-rose-50"
          >
            Delete
          </button>
        </div>
      </aside>

      {fullscreen && <Lightbox src={photoUrl(photo, 'full')} alt={photo.name} batchName={photo.batchName} photo={photo} onClose={() => setFullscreen(false)} />}
    </div>
  )
}

function NavButton({ side, onClick, children }: { side: 'left' | 'right'; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      aria-label={side === 'left' ? 'Previous photo' : 'Next photo'}
      className={`absolute top-1/2 ${side === 'left' ? 'left-4' : 'right-4'} flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-3xl text-white hover:bg-white/25`}
    >
      {children}
    </button>
  )
}
