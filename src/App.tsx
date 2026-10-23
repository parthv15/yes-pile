import { useState } from 'react'
import { importPhotos } from './importPhotos'
import { useRoute } from './route'
import BoardsView from './views/BoardsView'
import BoardView from './views/BoardView'
import DecisionView from './views/DecisionView'
import UploadDialog from './components/UploadDialog'

export type { Tab } from './route'

export interface ImportState {
  done: number
  total: number
  added?: number
  failed?: string[]
  batchName?: string
}

export default function App() {
  const route = useRoute()
  const [importing, setImporting] = useState<ImportState | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploads, setUploads] = useState<{ id: string; boardId: number; files: File[] }[]>([])

  // Photos are added to the board you're in. There's nowhere to put them on the list of boards.
  const boardId = route.page === 'boards' ? undefined : route.boardId

  function addFiles(files: File[]) {
    const images = files.filter((file) => file.type.startsWith('image/'))
    if (!images.length || boardId === undefined) return
    // Keep separate selections separate, including drops made during an import.
    setUploads((pending) => [...pending, { id: crypto.randomUUID(), boardId, files: images }])
  }

  async function confirmUpload(batchName: string) {
    const upload = uploads[0]
    if (!upload || (importing && importing.added === undefined)) return
    setImporting({ done: 0, total: upload.files.length, batchName })
    setUploads((pending) => pending.slice(1))
    const result = await importPhotos(upload.boardId, upload.files, (done, total) => setImporting({ done, total, batchName }), batchName)
    setImporting((s) => s && { ...s, ...result })
  }

  const status = importing && (
    <div role="status" className="flex w-full min-w-0 flex-wrap items-center gap-3 text-xs text-stone-600 sm:ml-auto sm:w-auto sm:shrink-0 sm:text-sm">
      {importing.batchName && <span className="max-w-48 truncate font-medium" title={importing.batchName}>{importing.batchName}</span>}
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
  )

  return (
    <div
      className={`app-shell flex flex-col ${route.page === 'decision' ? 'has-tab-bar' : ''}`}
      onDragOver={(e) => {
        if (boardId === undefined || !e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.relatedTarget === null) setDragging(false)
      }}
      onDrop={(e) => {
        if (boardId === undefined || !e.dataTransfer.files.length) return
        e.preventDefault()
        setDragging(false)
        addFiles([...e.dataTransfer.files])
      }}
    >
      {route.page === 'boards' && <BoardsView status={status} />}
      {route.page === 'board' && <BoardView key={route.boardId} boardId={route.boardId} onFiles={addFiles} status={status} />}
      {route.page === 'decision' && (
        <DecisionView
          key={route.decisionId}
          boardId={route.boardId}
          decisionId={route.decisionId}
          tab={route.tab}
          onFiles={addFiles}
          status={status}
        />
      )}

      {uploads[0] && (!importing || importing.added !== undefined) && (
        <UploadDialog
          key={uploads[0].id}
          files={uploads[0].files}
          onConfirm={confirmUpload}
          onCancel={() => setUploads((pending) => pending.slice(1))}
        />
      )}

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
