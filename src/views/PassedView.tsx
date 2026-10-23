import { useState } from 'react'
import { allLabels, bringBack, deletePhotos, groupsOf, passedPhotos, type Group, type Photo } from '../db'
import PhotoCard from '../components/PhotoCard'
import PhotoModal from '../components/PhotoModal'
import type { Tab } from '../App'
import { useDecision } from '../decision'

interface Props {
  photos: Photo[]
  groups: Group[]
  goTo: (tab: Tab) => void
}

export default function PassedView({ photos, groups, goTo }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const { board, decision } = useDecision()
  const [openId, setOpenId] = useState<number | null>(null)

  const passed = passedPhotos(photos)
  // One section per round, most recent first. Round 0 is photos passed before rounds were tracked.
  const rounds = [...new Set(passed.map((p) => p.outRound))]
  const sections = rounds.map((round) => ({ round, photos: passed.filter((p) => p.outRound === round) }))
  const openIndex = passed.findIndex((p) => p.id === openId)
  const openPhoto = photos.find((p) => p.id === openId)

  const toggle = (id: number) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  async function bringBackSelected() {
    await bringBack(decision.id, [...selected])
    setSelected(new Set())
  }

  async function deleteSelected() {
    if (!confirm(`Delete ${selected.size} photo${selected.size === 1 ? '' : 's'} for good? ${selected.size === 1 ? 'It' : 'They'}'ll be gone from every decision in ${board.name}.`)) return
    await deletePhotos([...selected])
    setSelected(new Set())
  }

  async function deleteAll() {
    if (!confirm(`Delete all ${passed.length} passed photos for good? They'll be gone from every decision in ${board.name}, and you won't be able to bring them back.`)) return
    await deletePhotos(passed.map((p) => p.id))
  }

  if (passed.length === 0) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-4 py-6 text-center sm:px-8">
        <p className="font-display text-3xl">Nothing passed yet</p>
        <p className="mt-2 max-w-md text-stone-500">
          Photos you pass on land here, so you can look again and bring any back if you change your mind.
        </p>
        <button onClick={() => goTo('review')} className="mt-6 rounded-full bg-stone-900 px-6 py-3 font-medium text-white">
          Go to review
        </button>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-stone-200 bg-stone-50/95 px-4 py-3 backdrop-blur sm:px-8">
        {selected.size > 0 ? (
          <>
            <span className="mr-2 text-sm font-medium">{selected.size} selected</span>
            <button onClick={bringBackSelected} className="rounded-full bg-stone-900 px-3 py-1.5 text-sm text-white">
              ↩ Bring back
            </button>
            <button onClick={deleteSelected} className="rounded-full px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50">
              Delete
            </button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-sm text-stone-500 hover:text-stone-900">
              Clear selection
            </button>
          </>
        ) : (
          <>
            <span className="mr-2 text-sm text-stone-500">
              {passed.length} passed <span className="sm:hidden">· Bring any back to rejoin your liked photos</span><span className="hidden sm:inline">· Bring any back and they rejoin your liked photos · Shift-click or tick to select</span>
            </span>
            <button onClick={deleteAll} className="ml-auto rounded-full px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50">
              Delete all passed
            </button>
          </>
        )}
      </div>

      <div className="flex flex-col gap-5 px-2 py-4 sm:gap-8 sm:px-8 sm:py-6">
        {sections.map(({ round, photos: sectionPhotos }) => (
          <section key={round} className="p-2 sm:p-4">
            <div className="mb-3 flex items-baseline gap-3">
              <h2 className="font-display text-xl">{round ? `Passed in round ${round}` : 'Passed earlier'}</h2>
              <span className="text-sm text-stone-400">{sectionPhotos.length}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
              {sectionPhotos.map((p) => (
                <div key={p.id} className="group relative min-w-0">
                  <PhotoCard
                    photo={p}
                    groups={groupsOf(p, groups)}
                    selected={selected.has(p.id)}
                    onOpen={() => setOpenId(p.id)}
                    onToggleSelect={() => toggle(p.id)}
                  />
                  <button
                    onClick={() => bringBack(decision.id, [p.id])}
                    className="card-actions mt-2 w-full rounded-full border border-stone-300 bg-white py-1.5 text-sm font-medium shadow hover:bg-stone-50 sm:absolute sm:inset-x-2 sm:top-10 sm:mt-0 sm:w-auto sm:border-0 sm:bg-white/90 sm:opacity-0 sm:transition sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:hover:bg-white"
                  >
                    ↩ Bring back
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {openPhoto && (
        <PhotoModal
          photo={openPhoto}
          groups={groups}
          labels={allLabels(photos)}
          onClose={() => setOpenId(null)}
          onPrev={openIndex > 0 ? () => setOpenId(passed[openIndex - 1].id) : undefined}
          onNext={openIndex >= 0 && openIndex < passed.length - 1 ? () => setOpenId(passed[openIndex + 1].id) : undefined}
        />
      )}
    </div>
  )
}
