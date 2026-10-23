import { useState } from 'react'
import { groupsOf, isUndecided, likePhotos, maybePhotos, passPhotos, type Group, type Photo } from '../db'
import PhotoCard from '../components/PhotoCard'
import type { Tab } from '../App'
import { useDecision } from '../decision'
import { plural } from '../format'

interface Props {
  photos: Photo[]
  groups: Group[]
  round: number
  goTo: (tab: Tab) => void
  /** Open review on this photo. */
  onReview: (photoId: number) => void
}

/** Photos set aside with Maybe this round, to like or pass when you're ready. */
export default function MaybeView({ photos, groups, round, goTo, onReview }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const { decision } = useDecision()

  const maybes = maybePhotos(photos, round)
  // Review shows photos you haven't looked at yet before bringing maybes back.
  const unseen = photos.filter((p) => isUndecided(p, round) && !p.maybe && !p.yes && !p.theOne).length

  const toggle = (id: number) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  async function decideSelected(kind: 'like' | 'pass') {
    await (kind === 'like' ? likePhotos : passPhotos)(decision, [...selected])
    setSelected(new Set())
  }

  if (maybes.length === 0) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-4 py-6 text-center sm:px-8">
        <p className="font-display text-3xl">No maybes</p>
        <p className="mt-2 max-w-md text-stone-500">
          Not sure about a photo? Press <b className="font-medium text-stone-700">Maybe</b> during review to set it aside. It waits
          here, and comes back in review once you've seen everything else.
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
            <button onClick={() => decideSelected('like')} className="rounded-full bg-stone-900 px-3 py-1.5 text-sm text-white">
              ❤️ Like
            </button>
            <button
              onClick={() => decideSelected('pass')}
              className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-100"
            >
              Pass
            </button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-sm text-stone-500 hover:text-stone-900">
              Clear selection
            </button>
          </>
        ) : (
          <>
            <span className="mr-2 text-sm text-stone-500">
              {plural(maybes.length, 'maybe')} in round {round}
              <span className="hidden sm:inline"> · Like or pass here, or open one to decide in review · Shift-click or tick to select</span>
            </span>
            <button
              onClick={() => (unseen ? goTo('review') : onReview(maybes[0].id))}
              className="ml-auto rounded-full bg-stone-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-stone-700"
            >
              {unseen ? 'Continue review' : 'Decide in review'}
            </button>
          </>
        )}
      </div>

      {unseen > 0 && (
        <p className="px-4 pt-4 text-sm text-stone-500 sm:px-8">
          Review brings these back after the {plural(unseen, 'photo')} you haven't seen yet this round.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 px-4 py-4 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] sm:px-8 sm:py-6">
        {maybes.map((p) => (
          <div key={p.id} className="group relative min-w-0">
            <PhotoCard
              photo={p}
              groups={groupsOf(p, groups)}
              selected={selected.has(p.id)}
              onOpen={() => onReview(p.id)}
              onToggleSelect={() => toggle(p.id)}
            />
            <div className="card-actions mt-2 flex gap-2 sm:absolute sm:inset-x-2 sm:top-10 sm:mt-0 sm:opacity-0 sm:transition sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              <button
                onClick={() => passPhotos(decision, [p.id])}
                className="flex-1 rounded-full border border-stone-300 bg-white py-1.5 text-sm font-medium shadow hover:bg-stone-50 sm:border-0 sm:bg-white/90 sm:hover:bg-white"
              >
                Pass
              </button>
              <button
                onClick={() => likePhotos(decision, [p.id])}
                className="flex-1 rounded-full bg-stone-900 py-1.5 text-sm font-medium text-white shadow hover:bg-stone-700"
              >
                ❤️ Like
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
