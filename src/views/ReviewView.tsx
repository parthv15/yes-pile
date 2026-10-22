import { useEffect, useRef, useState } from 'react'
import { addToGroup, createGroup, db, groupsOf, isUndecided, photoUrl, roundPhotos, setRound, toggleGroup, type Group, type Photo } from '../db'
import type { Tab } from '../App'
import Lightbox from '../components/Lightbox'
import ReviewCarousel, { type Move, type MoveKind } from '../components/ReviewCarousel'

interface Props {
  photos: Photo[]
  groups: Group[]
  round: number
  goTo: (tab: Tab) => void
}

type Snapshot = Pick<Photo, 'id' | 'level' | 'out' | 'outRound'>

export default function ReviewView({ photos, groups, round, goTo }: Props) {
  const list = roundPhotos(photos, round)
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [history, setHistory] = useState<Snapshot[]>([])
  const [move, setMove] = useState<Move>({ kind: 'next', seq: 0 })
  // Bumped when a photo is liked or passed, so its card leaves with an animation
  // and a fresh one takes its place in the carousel.
  const [generation, setGeneration] = useState<Record<number, number>>({})
  // The last photo of the round was just decided; let its animation play before the round-done screen.
  const [finishing, setFinishing] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const busy = useRef(false)

  // Show the chosen photo, or else the first one still undecided.
  let index = list.findIndex((p) => p.id === currentId)
  if (index === -1) index = list.findIndex((p) => isUndecided(p, round))
  const photo = index >= 0 ? list[index] : undefined
  const undecided = photo ? isUndecided(photo, round) : false

  const progress = {
    liked: list.filter((p) => !p.out && p.level >= round).length,
    passed: list.filter((p) => p.out).length,
    total: list.length,
  }
  const done = progress.liked + progress.passed

  /** The next undecided photo after position i, wrapping around to the start. */
  function nextUndecided(i: number) {
    for (let step = 1; step < list.length; step++) {
      const p = list[(i + step) % list.length]
      if (isUndecided(p, round)) return p
    }
    return undefined
  }

  /** What Next (or Maybe) moves on to. Shown peeking in on the right. */
  const incoming = photo && (undecided ? nextUndecided(index) : (list[index + 1] ?? nextUndecided(index)))
  const previous = index > 0 ? list[index - 1] : undefined
  const keyOf = (p: Photo) => `${p.id}:${generation[p.id] ?? 0}`

  /** Show another photo, sliding the carousel the right way. `null` falls back to the first undecided photo, or the round-done screen. */
  function go(kind: MoveKind, id: number | null, leaving?: Photo) {
    setMove((m) => ({ kind, seq: m.seq + 1, leaving: leaving && keyOf(leaving) }))
    if (leaving) setGeneration((g) => ({ ...g, [leaving.id]: (g[leaving.id] ?? 0) + 1 }))
    setCurrentId(id)
  }

  async function decide(kind: 'like' | 'pass') {
    if (!photo || busy.current) return
    busy.current = true
    setHistory((h) => [...h.slice(-50), { id: photo.id, level: photo.level, out: photo.out, outRound: photo.outRound }])
    const following = nextUndecided(index)
    // Move on before saving, so the card animates away instead of first flashing its new state.
    go(kind, following?.id ?? photo.id, photo)
    if (!following) setFinishing(true)
    await db.photos.update(
      photo.id,
      kind === 'like' ? { level: round, out: false, outRound: 0 } : { out: true, outRound: round },
    )
    if (following) {
      busy.current = false
      return
    }
    setTimeout(() => {
      setFinishing(false)
      setCurrentId(null)
      busy.current = false
    }, 500)
  }

  /** Maybe on an undecided photo: leave it for later. Next on a decided one: step forward. */
  function next() {
    if (!photo || busy.current) return
    if (incoming) go('next', incoming.id)
    else if (!undecided) go('next', null)
  }

  function back() {
    if (busy.current) return
    if (photo && previous) go('back', previous.id)
    else if (!photo && list.length) setCurrentId(list[list.length - 1].id)
  }

  async function undo() {
    const last = history[history.length - 1]
    if (!last || busy.current) return
    setHistory((h) => h.slice(0, -1))
    const { id, ...rest } = last
    await db.photos.update(id, rest)
    go('back', id)
  }

  async function toggle(group: Group) {
    if (photo) await toggleGroup(photo, group.id)
  }

  async function newGroup() {
    if (!photo) return
    const name = prompt('Name the new group (e.g. "Florals" or "Studio Aurora")')?.trim()
    if (!name) return
    await addToGroup([photo.id], await createGroup(name))
  }

  // Keyboard shortcuts. Re-bound each render so handlers see the latest photo.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowRight' || e.key === 'l') decide('like')
      else if (e.key === 'ArrowLeft' || e.key === 'p') decide('pass')
      else if (e.key === 'ArrowDown' || e.key === 'm' || e.key === 'n') next()
      else if (e.key === 'ArrowUp' || e.key === 'b') back()
      else if (e.key === 'z' || e.key === 'Backspace') undo()
      else if (e.key === 'f' && photo) setFullscreen(true)
      else if (/^[1-9]$/.test(e.key) && groups[Number(e.key) - 1]) toggle(groups[Number(e.key) - 1])
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (photos.length === 0) {
    return (
      <Centered>
        <p className="font-display text-3xl">Nothing to review yet</p>
        <button onClick={() => goTo('add')} className="mt-6 rounded-full bg-stone-900 px-6 py-3 font-medium text-white">
          Add photos
        </button>
      </Centered>
    )
  }

  if (!photo) {
    const stillIn = photos.filter((p) => !p.out && !p.yes && !p.theOne).length
    return (
      <Centered>
        <p className="text-sm font-medium uppercase tracking-widest text-rose-500">Round {round} done</p>
        <p className="mt-3 font-display text-3xl sm:text-4xl">
          {stillIn === 0
            ? 'Nothing left in the running'
            : stillIn === 1
              ? 'Down to one.'
              : `${stillIn} still in the running`}
        </p>
        <p className="mt-3 max-w-md text-stone-500">
          {progress.liked} liked, {progress.passed} passed this round.
          {stillIn > 1 && ' Go again to narrow it down, or head to your liked photos to group, label and pick.'}
          {stillIn === 1 && ' Open it in Liked and crown it THE ONE.'}
          {stillIn === 0 && ' Passed photos can be brought back from the Passed tab.'}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3 sm:mt-8">
          {stillIn > 1 && (
            <button
              onClick={() => setRound(round + 1)}
              className="rounded-full bg-stone-900 px-6 py-3 font-medium text-white hover:bg-stone-700"
            >
              Start round {round + 1} →
            </button>
          )}
          <button onClick={() => goTo('pile')} className="rounded-full border border-stone-300 px-6 py-3 font-medium hover:bg-stone-100">
            See liked photos
          </button>
          {progress.passed > 0 && (
            <button onClick={() => goTo('passed')} className="rounded-full border border-stone-300 px-6 py-3 font-medium hover:bg-stone-100">
              See passed photos
            </button>
          )}
          {list.length > 0 && (
            <button onClick={back} className="rounded-full px-6 py-3 font-medium text-stone-500 hover:bg-stone-100">
              <span className="hidden sm:inline">↑&nbsp;</span>Back to last photo
            </button>
          )}
        </div>
      </Centered>
    )
  }

  const photoGroups = groupsOf(photo, groups)
  // While the last card animates away, the buttons keep looking undecided.
  const liked = !finishing && !photo.out && photo.level >= round
  const passed = !finishing && photo.out

  return (
    <div className="review-view flex h-full flex-col">
      <div className="review-progress flex items-center gap-2 px-4 pt-3 text-xs sm:gap-4 sm:px-8 sm:pt-4 sm:text-sm text-stone-500">
        <span className="font-medium text-stone-900">Round {round}</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200">
          <div className="h-full bg-stone-900 transition-all" style={{ width: `${(done / progress.total) * 100}%` }} />
        </div>
        <span>
          {done} / {progress.total}
        </span>
        <span className="text-rose-600">❤️ {progress.liked}</span>
      </div>

      <div className="review-photo relative min-h-0 flex-1 overflow-hidden">
        <ReviewCarousel
          prev={previous && !finishing ? { key: keyOf(previous), photo: previous } : undefined}
          current={finishing ? undefined : { key: keyOf(photo), photo }}
          next={incoming && !finishing && incoming.id !== previous?.id ? { key: keyOf(incoming), photo: incoming } : undefined}
          move={move}
          onBack={back}
          onNext={next}
          onOpen={() => setFullscreen(true)}
        />
        {!finishing && (!undecided || photoGroups.length > 0 || photo.labels.length > 0) && (
          <div className="pointer-events-none absolute top-6 left-1/2 z-10 flex max-w-[90%] -translate-x-1/2 flex-wrap justify-center gap-1 sm:top-10 sm:gap-2">
            {!undecided && (
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap shadow ${
                  liked ? 'bg-stone-900 text-white' : 'bg-white text-stone-600'
                }`}
              >
                {liked ? '❤️ You liked this' : 'You passed on this'} · change it below
              </span>
            )}
            {photoGroups.map((g) => (
              <span key={g.id} className="rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap text-white shadow" style={{ background: g.color }}>
                {g.name}
              </span>
            ))}
            {photo.labels.map((l) => (
              <span key={l} className="rounded-full bg-white/90 px-3 py-1 text-sm whitespace-nowrap shadow">
                {l}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="review-controls grid grid-cols-4 items-center gap-2 px-3 pb-2 sm:flex sm:justify-center sm:gap-3 sm:px-0">
        <button
          onClick={back}
          disabled={!previous}
          className="flex min-h-12 items-center justify-center rounded-full py-3 text-sm sm:w-28 sm:py-4 sm:text-base font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-30"
        >
          <span className="hidden sm:inline">↑&nbsp;</span>Back
        </button>
        <button
          onClick={() => decide('pass')}
          className={`flex min-h-12 items-center justify-center rounded-full border py-3 text-sm sm:w-36 sm:py-4 sm:text-lg font-medium ${
            passed ? 'border-stone-900 bg-stone-200' : 'border-stone-300 bg-white hover:bg-stone-100'
          }`}
        >
          <span className="hidden sm:inline">←&nbsp;</span>Pass
        </button>
        <button
          onClick={next}
          className="flex min-h-12 items-center justify-center rounded-full border border-stone-300 bg-white py-3 text-sm sm:w-36 sm:py-4 sm:text-lg font-medium hover:bg-stone-100"
        >
          {undecided || finishing ? 'Maybe' : 'Next'}<span className="hidden sm:inline">&nbsp;↓</span>
        </button>
        <button
          onClick={() => decide('like')}
          className={`flex min-h-12 items-center justify-center rounded-full py-3 text-sm sm:w-36 sm:py-4 sm:text-lg font-medium text-white ${
            liked ? 'bg-rose-600 ring-4 ring-rose-200' : 'bg-stone-900 hover:bg-stone-700'
          }`}
        >
          ❤️ Like<span className="hidden sm:inline">&nbsp;→</span>
        </button>
      </div>
      <p className="review-hints pb-2 text-center text-xs text-stone-500 sm:pb-4">
        <span className="hidden sm:inline">← pass · → like · ↓ maybe / next · ↑ back · F full screen · </span>
        <button onClick={undo} disabled={!history.length} className="min-h-11 px-3 underline disabled:no-underline disabled:opacity-50">
          <span className="hidden sm:inline">Z </span>Undo
        </button>
      </p>

      <div className="review-groups flex shrink-0 items-center gap-2 overflow-x-auto border-t border-stone-200 bg-white px-3 py-2 text-sm sm:flex-wrap sm:justify-center sm:px-8 sm:py-3">
        <span className="text-stone-400">Group:</span>
        {groups.slice(0, 9).map((g, i) => (
          <button
            key={g.id}
            onClick={() => toggle(g)}
            className="flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3 py-1"
            style={
              photo.groupIds.includes(g.id)
                ? { background: g.color, borderColor: g.color, color: 'white' }
                : { borderColor: '#e7e5e4' }
            }
          >
            <kbd className="hidden text-xs opacity-60 sm:inline">{i + 1}</kbd>
            {g.name}
          </button>
        ))}
        <button onClick={newGroup} className="min-h-11 shrink-0 rounded-full px-3 py-1 text-stone-500 hover:bg-stone-100">
          + New group
        </button>
      </div>

      {fullscreen && <Lightbox src={photoUrl(photo, 'full')} alt={photo.name} onClose={() => setFullscreen(false)} />}
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-full flex-col items-center justify-center px-4 py-6 text-center sm:px-8">{children}</div>
}
