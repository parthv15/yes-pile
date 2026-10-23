import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, likedPhotos, maybePhotos, passedPhotos, reviewQueue, withVerdicts } from '../db'
import { DecisionContext } from '../decision'
import { navigate, type Tab } from '../route'
import AppHeader from '../components/AppHeader'
import AddView from './AddView'
import ReviewView from './ReviewView'
import PileView from './PileView'
import MaybeView from './MaybeView'
import PassedView from './PassedView'
import YesView from './YesView'

interface Props {
  boardId: number
  decisionId: number
  tab?: Tab
  onFiles: (files: File[]) => void
  status: React.ReactNode
}

/** One decision: review its board's photos in rounds, sort what you like and pick THE ONE. */
export default function DecisionView({ boardId, decisionId, tab, onFiles, status }: Props) {
  // `null` once loaded means it doesn't exist; `undefined` means still loading.
  const board = useLiveQuery(async () => (await db.boards.get(boardId)) ?? null, [boardId])
  const decision = useLiveQuery(async () => (await db.decisions.get(decisionId)) ?? null, [decisionId])
  const stored = useLiveQuery(() => db.photos.where('boardId').equals(boardId).toArray(), [boardId])
  const verdicts = useLiveQuery(() => db.verdicts.where('decisionId').equals(decisionId).toArray(), [decisionId])
  const groups = useLiveQuery(() => db.groups.where('decisionId').equals(decisionId).toArray(), [decisionId])
  const photos = useMemo(() => stored && verdicts && withVerdicts(stored, verdicts), [stored, verdicts])
  // A photo picked from the Maybe tab, for review to open on.
  const [reviewStart, setReviewStart] = useState<number>()

  // A deleted or mistyped decision sends you to the board, or to all boards if that's gone too.
  const missing = board === null || decision === null || (decision && decision.boardId !== boardId)
  useEffect(() => {
    if (!missing) return
    navigate(board ? { page: 'board', boardId } : { page: 'boards' }, { replace: true })
  }, [missing, board, boardId])

  if (!board || !decision || missing || !photos || !groups) return null

  const round = decision.round
  const queue = reviewQueue(photos, round)
  const liked = likedPhotos(photos)
  const maybes = maybePhotos(photos, round)
  const passed = passedPhotos(photos)
  const yesCount = photos.filter((p) => p.yes || p.theOne).length
  const current: Tab = tab ?? (photos.length === 0 ? 'add' : queue.length ? 'review' : 'pile')
  const goTo = (next: Tab) => {
    // Opening review from its tab starts where review would, not on a photo picked earlier.
    if (next !== 'review') setReviewStart(undefined)
    navigate({ page: 'decision', boardId, decisionId, tab: next }, { replace: true })
  }

  // `short` replaces the label on phones, where six tabs share the width.
  const tabs: { id: Tab; label: string; short?: string; count?: string }[] = [
    { id: 'add', label: 'Add photos', short: 'Add', count: String(photos.length) },
    { id: 'review', label: `Round ${round}`, count: queue.length ? `${queue.length} left` : 'done' },
    { id: 'pile', label: 'Liked', count: String(liked.length) },
    { id: 'maybe', label: 'Maybe', count: String(maybes.length) },
    { id: 'passed', label: 'Passed', count: String(passed.length) },
    { id: 'yes', label: 'Yes Pile', count: String(yesCount) },
  ]

  const nav = (
    <nav aria-label="Decision" className="app-nav flex gap-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => goTo(t.id)}
          aria-current={current === t.id ? 'page' : undefined}
          className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center rounded-2xl px-1 py-2 text-xs whitespace-nowrap font-medium transition sm:block sm:min-h-0 sm:flex-none sm:rounded-full sm:px-4 sm:text-sm ${
            current === t.id ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          {t.short ? (
            <>
              <span className="sm:hidden">{t.short}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </>
          ) : (
            t.label
          )}
          <span className={`text-[10px] sm:ml-2 sm:text-xs ${current === t.id ? 'text-stone-300' : 'text-stone-400'}`}>
            {t.count}
          </span>
        </button>
      ))}
    </nav>
  )

  return (
    <DecisionContext.Provider value={{ board, decision }}>
      <AppHeader board={board} decision={decision} nav={nav} status={status} />
      <main className="min-h-0 flex-1 overflow-y-auto">
        {current === 'add' && <AddView photos={photos} onFiles={onFiles} goTo={goTo} />}
        {current === 'review' && <ReviewView photos={photos} groups={groups} round={round} goTo={goTo} startAt={reviewStart} />}
        {current === 'pile' && <PileView photos={photos} groups={groups} round={round} />}
        {current === 'maybe' && (
          <MaybeView
            photos={photos}
            groups={groups}
            round={round}
            goTo={goTo}
            onReview={(photoId) => {
              setReviewStart(photoId)
              navigate({ page: 'decision', boardId, decisionId, tab: 'review' }, { replace: true })
            }}
          />
        )}
        {current === 'passed' && <PassedView photos={photos} groups={groups} goTo={goTo} />}
        {current === 'yes' && <YesView photos={photos} groups={groups} goTo={goTo} />}
      </main>
    </DecisionContext.Provider>
  )
}
