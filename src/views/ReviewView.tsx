import { useEffect, useRef, useState } from 'react'
import { createGroup, db, photoUrl, reviewQueue, roundProgress, setRound, type Group, type Photo } from '../db'
import type { Tab } from '../App'

interface Props {
  photos: Photo[]
  groups: Group[]
  round: number
  goTo: (tab: Tab) => void
}

type Snapshot = Pick<Photo, 'id' | 'level' | 'out' | 'outRound'>

export default function ReviewView({ photos, groups, round, goTo }: Props) {
  const queue = reviewQueue(photos, round)
  const progress = roundProgress(photos, round)
  const photo = queue[0]
  const next = queue[1]
  const [history, setHistory] = useState<Snapshot[]>([])
  const [flash, setFlash] = useState<'like' | 'pass' | null>(null)
  const busy = useRef(false)

  async function decide(kind: 'like' | 'pass') {
    if (!photo || busy.current) return
    busy.current = true
    setHistory((h) => [...h.slice(-50), { id: photo.id, level: photo.level, out: photo.out, outRound: photo.outRound }])
    setFlash(kind)
    await db.photos.update(photo.id, kind === 'like' ? { level: round } : { out: true, outRound: round })
    setTimeout(() => setFlash(null), 250)
    busy.current = false
  }

  async function undo() {
    const last = history[history.length - 1]
    if (!last) return
    setHistory((h) => h.slice(0, -1))
    const { id, ...rest } = last
    await db.photos.update(id, rest)
  }

  async function toggleGroup(group: Group) {
    if (!photo) return
    await db.photos.update(photo.id, { groupId: photo.groupId === group.id ? null : group.id })
  }

  async function newGroup() {
    if (!photo) return
    const name = prompt('Name the new group (e.g. "Florals" or "Studio Aurora")')?.trim()
    if (!name) return
    const id = await createGroup(name)
    await db.photos.update(photo.id, { groupId: id })
  }

  // Keyboard shortcuts. Re-bound each render so handlers see the latest photo.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowRight' || e.key === 'l') decide('like')
      else if (e.key === 'ArrowLeft' || e.key === 'p') decide('pass')
      else if (e.key === 'z' || e.key === 'Backspace') undo()
      else if (/^[1-9]$/.test(e.key) && groups[Number(e.key) - 1]) toggleGroup(groups[Number(e.key) - 1])
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
        <p className="mt-3 font-display text-4xl">
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
          {stillIn === 0 && ' Passed photos can be brought back from the Liked tab.'}
        </p>
        <div className="mt-8 flex gap-3">
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
          {history.length > 0 && (
            <button onClick={undo} className="rounded-full px-6 py-3 font-medium text-stone-500 hover:bg-stone-100">
              Undo last
            </button>
          )}
        </div>
      </Centered>
    )
  }

  const group = groups.find((g) => g.id === photo.groupId)
  const done = progress.total - progress.left

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 px-8 pt-4 text-sm text-stone-500">
        <span className="font-medium text-stone-900">Round {round}</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200">
          <div className="h-full bg-stone-900 transition-all" style={{ width: `${(done / progress.total) * 100}%` }} />
        </div>
        <span>
          {done} / {progress.total}
        </span>
        <span className="text-rose-600">❤️ {progress.liked}</span>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-6">
        <img
          key={photo.id}
          src={photoUrl(photo, 'full')}
          alt={photo.name}
          className={`max-h-full max-w-full rounded-2xl object-contain shadow-xl transition duration-200 ${
            flash === 'like' ? 'translate-x-6 opacity-60' : flash === 'pass' ? '-translate-x-6 opacity-60' : ''
          }`}
        />
        {next && <link rel="preload" as="image" href={photoUrl(next, 'full')} />}
        {(group || photo.labels.length > 0) && (
          <div className="absolute top-8 left-1/2 flex -translate-x-1/2 gap-2">
            {group && (
              <span className="rounded-full px-3 py-1 text-sm font-medium text-white" style={{ background: group.color }}>
                {group.name}
              </span>
            )}
            {photo.labels.map((l) => (
              <span key={l} className="rounded-full bg-white/90 px-3 py-1 text-sm shadow">
                {l}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-6 pb-6">
        <button
          onClick={() => decide('pass')}
          className="flex w-40 items-center justify-center gap-2 rounded-full border border-stone-300 bg-white py-4 text-lg font-medium hover:bg-stone-100"
        >
          ← Pass
        </button>
        <button
          onClick={undo}
          disabled={!history.length}
          className="rounded-full px-4 py-2 text-sm text-stone-500 hover:bg-stone-100 disabled:opacity-30"
        >
          Undo (Z)
        </button>
        <button
          onClick={() => decide('like')}
          className="flex w-40 items-center justify-center gap-2 rounded-full bg-stone-900 py-4 text-lg font-medium text-white hover:bg-stone-700"
        >
          ❤️ Like →
        </button>
      </div>

      {(
        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-stone-200 bg-white px-8 py-3 text-sm">
          <span className="text-stone-400">Group:</span>
          {groups.slice(0, 9).map((g, i) => (
            <button
              key={g.id}
              onClick={() => toggleGroup(g)}
              className="flex items-center gap-2 rounded-full border px-3 py-1"
              style={
                photo.groupId === g.id
                  ? { background: g.color, borderColor: g.color, color: 'white' }
                  : { borderColor: '#e7e5e4' }
              }
            >
              <kbd className="text-xs opacity-60">{i + 1}</kbd>
              {g.name}
            </button>
          ))}
          <button onClick={newGroup} className="rounded-full px-3 py-1 text-stone-500 hover:bg-stone-100">
            + New group
          </button>
        </div>
      )}
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center px-8 text-center">{children}</div>
}
