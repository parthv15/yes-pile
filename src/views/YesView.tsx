import { useState } from 'react'
import { allLabels, db, groupsOf, makeTheOne, photoUrl, type Group, type Photo } from '../db'
import { exportYesPile } from '../exportZip'
import PhotoCard from '../components/PhotoCard'
import PhotoModal from '../components/PhotoModal'
import type { Tab } from '../App'

interface Props {
  photos: Photo[]
  groups: Group[]
  goTo: (tab: Tab) => void
}

export default function YesView({ photos, groups, goTo }: Props) {
  const [openId, setOpenId] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)

  const theOne = photos.find((p) => p.theOne)
  const yes = photos.filter((p) => p.yes && !p.theOne).sort((a, b) => a.addedAt - b.addedAt)
  const ordered = [...(theOne ? [theOne] : []), ...yes]
  const openIndex = ordered.findIndex((p) => p.id === openId)
  const openPhoto = photos.find((p) => p.id === openId)

  async function exportAll() {
    setExporting(true)
    try {
      await exportYesPile(ordered, groups)
    } finally {
      setExporting(false)
    }
  }

  if (ordered.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center">
        <p className="font-display text-3xl">Your Yes Pile is empty</p>
        <p className="mt-2 max-w-md text-stone-500">
          Open a liked photo and choose <b>THE ONE!</b> or <b>Add to Yes Pile</b>.
        </p>
        <button onClick={() => goTo('pile')} className="mt-6 rounded-full bg-stone-900 px-6 py-3 font-medium text-white">
          See liked photos
        </button>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
        {theOne ? (
          <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:gap-10">
            <img
              src={photoUrl(theOne, 'full')}
              alt={theOne.name}
              onClick={() => setOpenId(theOne.id)}
              className="max-h-[45dvh] md:max-h-[70vh] max-w-full cursor-pointer justify-self-center rounded-3xl shadow-2xl"
            />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-rose-500">This is</p>
              <h2 className="mt-2 font-display text-5xl sm:text-7xl font-bold">THE ONE.</h2>
              <div className="mt-6 flex flex-wrap gap-2">
                {groupsOf(theOne, groups).map((g) => (
                  <span key={g.id} className="rounded-full px-3 py-1 text-sm font-medium text-white" style={{ background: g.color }}>
                    {g.name}
                  </span>
                ))}
                {theOne.labels.map((l) => (
                  <span key={l} className="rounded-full bg-stone-200 px-3 py-1 text-sm">
                    {l}
                  </span>
                ))}
              </div>
              {theOne.note && <p className="mt-4 whitespace-pre-wrap text-stone-600">{theOne.note}</p>}
              <p className="mt-6 text-sm text-stone-400">{theOne.name}</p>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border-2 border-dashed border-rose-200 px-8 py-12 text-center">
            <p className="font-display text-3xl">No ONE yet</p>
            <p className="mt-2 text-stone-500">Choose “Make THE ONE” on a photo below.</p>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 sm:mt-14">
          <h2 className="font-display text-2xl">
            Yes Pile <span className="text-stone-400">{yes.length}</span>
          </h2>
          <button
            onClick={exportAll}
            disabled={exporting}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-100 disabled:opacity-50"
          >
            {exporting ? 'Zipping…' : '↓ Download as zip'}
          </button>
        </div>
        {yes.length === 0 ? (
          <p className="mt-4 text-stone-500">Nothing else in the pile.</p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] sm:gap-4">
            {yes.map((p) => (
              <div key={p.id} className="yes-card group relative min-w-0">
                <PhotoCard photo={p} groups={groupsOf(p, groups)} onOpen={() => setOpenId(p.id)} />
                <div className="yes-actions mt-2 flex flex-col gap-2 sm:absolute sm:inset-x-2 sm:top-10 sm:mt-0 sm:gap-1 sm:opacity-0 sm:transition sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <button
                    onClick={() => makeTheOne(p.id)}
                    className="rounded-full bg-rose-500 py-1.5 text-sm font-semibold text-white shadow hover:bg-rose-600"
                  >
                    Make THE ONE
                  </button>
                  <button
                    onClick={() => db.photos.update(p.id, { yes: false })}
                    className="rounded-full bg-white/90 py-1.5 text-sm shadow hover:bg-white"
                  >
                    Remove from pile
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {openPhoto && (
        <PhotoModal
          photo={openPhoto}
          groups={groups}
          labels={allLabels(photos)}
          onClose={() => setOpenId(null)}
          onPrev={openIndex > 0 ? () => setOpenId(ordered[openIndex - 1].id) : undefined}
          onNext={openIndex >= 0 && openIndex < ordered.length - 1 ? () => setOpenId(ordered[openIndex + 1].id) : undefined}
        />
      )}
    </div>
  )
}
