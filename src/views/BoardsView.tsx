import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { createBoard, db, type Board, type StoredPhoto } from '../db'
import { navigate, routeToHash } from '../route'
import AppHeader from '../components/AppHeader'
import Cover from '../components/Cover'
import NameForm from '../components/NameForm'
import { plural } from '../format'

interface Summary {
  board: Board
  photoCount: number
  decisionCount: number
  decidedCount: number
  cover: StoredPhoto[]
}

async function summarise(board: Board): Promise<Summary> {
  const photos = db.photos.where('boardId').equals(board.id)
  const decisionIds = await db.decisions.where('boardId').equals(board.id).primaryKeys()
  const theOnes = await db.verdicts.where('decisionId').anyOf(decisionIds).filter((v) => v.theOne).toArray()
  // THE ONE from each decision leads the cover, then the newest photos.
  const chosen = (await db.photos.bulkGet(theOnes.map((v) => v.photoId))).filter((p): p is StoredPhoto => !!p)
  const recent = await photos.clone().reverse().limit(4).toArray()
  const cover = [...chosen, ...recent.filter((p) => !chosen.some((c) => c.id === p.id))].slice(0, 4)
  return {
    board,
    photoCount: await photos.count(),
    decisionCount: decisionIds.length,
    decidedCount: theOnes.length,
    cover,
  }
}

/** Every board, newest first, and a way to start a new one. */
export default function BoardsView({ status }: { status: React.ReactNode }) {
  const summaries = useLiveQuery(async () => {
    const boards = await db.boards.reverse().toArray()
    return Promise.all(boards.map(summarise))
  }, [])
  const [creating, setCreating] = useState(false)

  if (!summaries) return null

  async function create(name: string) {
    const boardId = await createBoard(name)
    navigate({ page: 'board', boardId })
  }

  return (
    <>
      <AppHeader status={status} />
      <main className="min-h-0 flex-1 overflow-y-auto">
        {summaries.length === 0 ? (
          <div className="mx-auto flex min-h-full max-w-xl flex-col items-center justify-center px-4 py-10 text-center">
            <p className="font-display text-3xl sm:text-4xl">Start your first board</p>
            <p className="mt-3 text-stone-500">
              A board holds the photos for one big thing, like your wedding. Inside it, you'll narrow them down to THE ONE for each
              decision: the venue, the outfit, the photographer.
            </p>
            <div className="mt-8 w-full">
              <NameForm label="Board name" placeholder="e.g. Our wedding" submitLabel="Create board" onSubmit={create} />
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
            <h1 className="font-display text-3xl sm:text-4xl">Your boards</h1>
            <p className="mt-2 max-w-xl text-stone-500">Each board holds its own photos. Make a decision inside it for each thing you're choosing.</p>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {summaries.map(({ board, photoCount, decisionCount, decidedCount, cover }) => (
                <a
                  key={board.id}
                  href={routeToHash({ page: 'board', boardId: board.id })}
                  className="group overflow-hidden rounded-3xl bg-white ring-1 ring-stone-200 transition hover:shadow-lg hover:ring-stone-300"
                >
                  <Cover photos={cover} empty="No photos yet" />
                  <div className="p-4 sm:p-5">
                    <h2 className="truncate font-display text-xl" title={board.name}>
                      {board.name}
                    </h2>
                    <p className="mt-1 text-sm text-stone-500">
                      {plural(photoCount, 'photo')} · {plural(decisionCount, 'decision')}
                      {decidedCount > 0 && <span className="text-rose-600"> · ❤️ {decidedCount} decided</span>}
                    </p>
                  </div>
                </a>
              ))}

              <div className="flex min-h-48 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-stone-300 p-5 text-center">
                {creating ? (
                  <>
                    <p className="mb-4 font-display text-xl">Name your new board</p>
                    <NameForm
                      label="Board name"
                      placeholder="e.g. Our wedding"
                      submitLabel="Create"
                      onSubmit={create}
                      onCancel={() => setCreating(false)}
                    />
                  </>
                ) : (
                  <button onClick={() => setCreating(true)} className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-2xl py-6 text-stone-500 hover:text-stone-900">
                    <span className="text-3xl leading-none">+</span>
                    <span className="font-medium">New board</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
