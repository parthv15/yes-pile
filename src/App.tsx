import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getRound, likedPhotos, reviewQueue } from './db'
import { importPhotos } from './importPhotos'
import AddView from './views/AddView'
import ReviewView from './views/ReviewView'
import PileView from './views/PileView'
import YesView from './views/YesView'

export type Tab = 'add' | 'review' | 'pile' | 'yes'

export interface ImportState {
  done: number
  total: number
  added?: number
  failed?: string[]
}

export default function App() {
  const photos = useLiveQuery(() => db.photos.toArray(), [])
  const groups = useLiveQuery(() => db.groups.toArray(), [])
  const round = useLiveQuery(getRound, [])
  const [tab, setTab] = useState<Tab | null>(null)
  const [importing, setImporting] = useState<ImportState | null>(null)
  const [dragging, setDragging] = useState(false)

  if (!photos || !groups || round === undefined) return null

  const queue = reviewQueue(photos, round)
  const liked = likedPhotos(photos)
  const yesCount = photos.filter((p) => p.yes || p.theOne).length
  const current: Tab = tab ?? (photos.length === 0 ? 'add' : queue.length ? 'review' : 'pile')

  async function addFiles(files: File[]) {
    if (!files.length) return
    setImporting({ done: 0, total: files.length })
    const result = await importPhotos(files, (done, total) => setImporting({ done, total }))
    setImporting((s) => s && { ...s, ...result })
  }

  const tabs: { id: Tab; label: string; count?: string }[] = [
    { id: 'add', label: 'Add photos', count: String(photos.length) },
    { id: 'review', label: `Round ${round}`, count: queue.length ? `${queue.length} left` : 'done' },
    { id: 'pile', label: 'Liked', count: String(liked.length) },
    { id: 'yes', label: 'Yes Pile', count: String(yesCount) },
  ]

  return (
    <div
      className="app-shell flex flex-col"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.relatedTarget === null) setDragging(false)
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return
        e.preventDefault()
        setDragging(false)
        addFiles([...e.dataTransfer.files])
      }}
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-stone-200 bg-white px-4 py-3 sm:gap-8 sm:px-8 sm:py-4">
        <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
          Yes Pile ❤️
        </h1>
        <nav aria-label="Main navigation" className="app-nav flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={current === t.id ? 'page' : undefined}
              className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center rounded-2xl px-1 py-2 text-xs whitespace-nowrap font-medium transition sm:block sm:min-h-0 sm:flex-none sm:rounded-full sm:px-4 sm:text-sm ${
                current === t.id ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {t.label}
              <span className={`text-[10px] sm:ml-2 sm:text-xs ${current === t.id ? 'text-stone-300' : 'text-stone-400'}`}>
                {t.count}
              </span>
            </button>
          ))}
        </nav>
        {importing && (
          <div className="flex w-full items-center gap-3 text-xs text-stone-600 sm:ml-auto sm:w-auto sm:text-sm">
            {importing.added === undefined ? (
              <>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-stone-200">
                  <div
                    className="h-full bg-rose-500 transition-all"
                    style={{ width: `${(importing.done / importing.total) * 100}%` }}
                  />
                </div>
                Adding {importing.done} / {importing.total}
              </>
            ) : (
              <>
                Added {importing.added} photo{importing.added === 1 ? '' : 's'}
                {!!importing.failed?.length && (
                  <span className="text-rose-600" title={importing.failed.join('\n')}>
                    · {importing.failed.length} couldn't be read
                  </span>
                )}
                <button onClick={() => setImporting(null)} aria-label="Dismiss import status" className="flex h-11 w-11 items-center justify-center text-stone-400 hover:text-stone-700">
                  ✕
                </button>
              </>
            )}
          </div>
        )}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        {current === 'add' && <AddView photos={photos} onFiles={addFiles} goTo={setTab} />}
        {current === 'review' && <ReviewView photos={photos} groups={groups} round={round} goTo={setTab} />}
        {current === 'pile' && <PileView photos={photos} groups={groups} round={round} />}
        {current === 'yes' && <YesView photos={photos} groups={groups} goTo={setTab} />}
      </main>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-rose-500/10 backdrop-blur-sm">
          <div className="rounded-3xl border-2 border-dashed border-rose-400 bg-white/90 mx-4 px-6 py-10 text-center font-display text-2xl sm:px-16 sm:py-12 sm:text-3xl text-rose-600">
            Drop to add photos
          </div>
        </div>
      )}
    </div>
  )
}
