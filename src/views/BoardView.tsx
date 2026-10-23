import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  createDecision,
  db,
  deleteBoard,
  deleteDecision,
  isUndecided,
  likedPhotos,
  photoUrl,
  reviewQueue,
  roundPhotos,
  withVerdicts,
  type Decision,
  type StoredPhoto,
  type Verdict,
} from '../db'
import { navigate, routeToHash } from '../route'
import { plural } from '../format'
import AppHeader from '../components/AppHeader'
import Cover from '../components/Cover'
import NameForm from '../components/NameForm'
import PhotoPicker from '../components/PhotoPicker'

interface Props {
  boardId: number
  onFiles: (files: File[]) => void
  status: React.ReactNode
}

/** A board: its photos, and the decisions you're making from them. */
export default function BoardView({ boardId, onFiles, status }: Props) {
  // `null` once loaded means the board doesn't exist; `undefined` means still loading.
  const board = useLiveQuery(async () => (await db.boards.get(boardId)) ?? null, [boardId])
  const decisions = useLiveQuery(() => db.decisions.where('boardId').equals(boardId).toArray(), [boardId])
  const photos = useLiveQuery(() => db.photos.where('boardId').equals(boardId).toArray(), [boardId])
  const verdicts = useLiveQuery(
    async () => db.verdicts.where('decisionId').anyOf(await db.decisions.where('boardId').equals(boardId).primaryKeys()).toArray(),
    [boardId],
  )
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (board === null) navigate({ page: 'boards' }, { replace: true })
  }, [board])

  if (!board || !decisions || !photos || !verdicts) return null

  const recent = [...photos].sort((a, b) => b.addedAt - a.addedAt)

  async function create(name: string) {
    const decisionId = await createDecision(boardId, name)
    navigate({ page: 'decision', boardId, decisionId })
  }

  async function rename() {
    const name = prompt('Rename board', board!.name)?.trim()
    if (name) await db.boards.update(boardId, { name })
  }

  async function remove() {
    if (!confirm(`Delete ${board!.name}? Its ${plural(photos!.length, 'photo')} and every decision in it will be gone for good.`)) return
    await deleteBoard(boardId)
    navigate({ page: 'boards' }, { replace: true })
  }

  return (
    <>
      <AppHeader board={board} status={status} />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="min-w-0 break-words font-display text-3xl sm:text-4xl">{board.name}</h1>
            <div className="flex gap-3 text-sm text-stone-400">
              <button onClick={rename} className="hover:text-stone-900">
                Rename
              </button>
              <button onClick={remove} className="hover:text-rose-600">
                Delete board
              </button>
            </div>
          </div>
          <p className="mt-2 text-stone-500">
            {plural(photos.length, 'photo')}, shared by every decision on this board. Each decision narrows them down to its own THE ONE.
          </p>

          <section className="mt-10">
            <h2 className="font-display text-2xl">
              Decisions <span className="text-stone-400">{decisions.length}</span>
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {decisions.map((decision) => (
                <DecisionCard
                  key={decision.id}
                  decision={decision}
                  boardName={board.name}
                  photos={photos}
                  verdicts={verdicts.filter((v) => v.decisionId === decision.id)}
                />
              ))}
              <div className="flex min-h-48 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-stone-300 p-5 text-center">
                {creating || decisions.length === 0 ? (
                  <>
                    <p className="mb-1 font-display text-xl">{decisions.length ? 'What are you deciding next?' : 'What are you deciding first?'}</p>
                    <p className="mb-4 text-sm text-stone-500">It gets its own rounds and its own THE ONE.</p>
                    <NameForm
                      label="Decision name"
                      placeholder="e.g. Mehendi outfit"
                      submitLabel="Start"
                      onSubmit={create}
                      onCancel={decisions.length ? () => setCreating(false) : undefined}
                    />
                  </>
                ) : (
                  <button onClick={() => setCreating(true)} className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-2xl py-6 text-stone-500 hover:text-stone-900">
                    <span className="text-3xl leading-none">+</span>
                    <span className="font-medium">New decision</span>
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="mt-12 border-t border-stone-200 pt-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl">
                  Photos <span className="text-stone-400">{photos.length}</span>
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  <span className="hidden sm:inline">Drop photos anywhere on this page, or choose them. </span>New photos join every decision's next round.
                </p>
              </div>
              <PhotoPicker onFiles={onFiles} className="w-full sm:w-auto" />
            </div>
            {photos.length > 0 && (
              <>
                <div className="mt-6 grid grid-cols-4 gap-2 sm:grid-cols-8">
                  {recent.slice(0, 48).map((p) => (
                    <figure key={p.id} className="min-w-0">
                      <img src={photoUrl(p)} alt={p.name} className="aspect-square w-full rounded-lg object-cover" />
                      {p.batchName && (
                        <figcaption className="mt-1 truncate text-xs text-stone-500" title={p.batchName}>
                          {p.batchName}
                        </figcaption>
                      )}
                    </figure>
                  ))}
                </div>
                {photos.length > 48 && <p className="mt-2 text-sm text-stone-400">and {photos.length - 48} more</p>}
              </>
            )}
          </section>
        </div>
      </main>
    </>
  )
}

function DecisionCard({ decision, boardName, photos, verdicts }: { decision: Decision; boardName: string; photos: StoredPhoto[]; verdicts: Verdict[] }) {
  const judged = withVerdicts(photos, verdicts)
  const round = decision.round
  const theOne = judged.find((p) => p.theOne)
  const left = reviewQueue(judged, round).length
  const roundList = roundPhotos(judged, round)
  const done = roundList.filter((p) => !isUndecided(p, round)).length
  const stillIn = judged.filter((p) => !p.out && !p.yes && !p.theOne).length
  const favourites = likedPhotos(judged).sort((a, b) => b.level - a.level || a.addedAt - b.addedAt)
  const cover = theOne ? [theOne] : favourites.length ? favourites : [...photos].sort((a, b) => b.addedAt - a.addedAt)
  const href = routeToHash({ page: 'decision', boardId: decision.boardId, decisionId: decision.id })

  async function rename() {
    const name = prompt('Rename decision', decision.name)?.trim()
    if (name) await db.decisions.update(decision.id, { name })
  }

  async function remove() {
    if (!confirm(`Delete the decision "${decision.name}"? Its rounds, groups and THE ONE are lost. The photos stay on ${boardName}.`)) return
    await deleteDecision(decision.id)
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-stone-200 transition hover:shadow-lg hover:ring-stone-300">
      <a href={href} className="relative block">
        <Cover photos={cover} empty="Add photos to the board to start" />
        {theOne && (
          <span className="absolute top-3 left-3 rounded-full bg-rose-500 px-2.5 py-0.5 text-xs font-bold text-white shadow">THE ONE</span>
        )}
      </a>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <a href={href} className="truncate font-display text-xl hover:underline" title={decision.name}>
          {decision.name}
        </a>
        <p className={`mt-1 text-sm ${theOne ? 'font-medium text-rose-600' : 'text-stone-500'}`}>
          {theOne
            ? '❤️ Decided'
            : photos.length === 0
              ? 'No photos yet'
              : left
                ? `Round ${round} · ${left} left`
                : `Round ${round} done · ${stillIn} still in`}
        </p>
        {!theOne && roundList.length > 0 && (
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-stone-100" aria-hidden="true">
            <div className="h-full bg-stone-900" style={{ width: `${(done / roundList.length) * 100}%` }} />
          </div>
        )}
        <div className="mt-auto flex gap-3 pt-4 text-xs text-stone-400">
          <button onClick={rename} className="hover:text-stone-900">
            Rename
          </button>
          <button onClick={remove} className="hover:text-rose-600">
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
