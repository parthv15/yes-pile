import { deletePhotos, photoUrl, startDecisionOver, type Photo } from '../db'
import { useDecision } from '../decision'
import PhotoPicker from '../components/PhotoPicker'
import type { Tab } from '../App'

interface Props {
  photos: Photo[]
  onFiles: (files: File[]) => void
  goTo: (tab: Tab) => void
}

export default function AddView({ photos, onFiles, goTo }: Props) {
  const recent = [...photos].sort((a, b) => b.addedAt - a.addedAt)
  const { board, decision } = useDecision()

  async function startOver() {
    if (!confirm(`Put every photo back in the running for ${decision.name} and start again from round 1? Groups and labels are kept.`)) return
    await startDecisionOver(decision.id)
  }

  async function deleteEverything() {
    if (!confirm(`Delete all ${photos.length} photos from ${board.name}? They'll be gone from every decision in it. This can't be undone.`)) return
    await deletePhotos(photos.map((p) => p.id))
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
      <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-stone-300 bg-white px-4 py-8 sm:px-8 sm:py-16 text-center">
        <p className="font-display text-2xl sm:text-3xl"><span className="sm:hidden">Add your photos</span><span className="hidden sm:inline">Drop photos anywhere</span></p>
        <p className="mt-2 text-stone-500">Vendor shots, screenshots, inspiration. Add as many as you like.</p>
        <p className="mt-2 text-sm text-stone-500">Give each upload a name, like a vendor, to recognise it while reviewing.</p>
        <p className="mt-2 text-sm text-stone-500">Photos you add are shared by every decision in <b className="font-medium text-stone-700">{board.name}</b>.</p>
        <PhotoPicker onFiles={onFiles} className="mt-6 w-full sm:mt-8 sm:w-auto" />
        <p className="mt-6 text-xs text-stone-400">
          Photos stay in this browser only. Nothing is uploaded anywhere.
        </p>
      </div>

      {photos.length > 0 && (
        <>
          <div className="mt-10 flex items-baseline justify-between">
            <h2 className="font-display text-xl">
              {photos.length} photo{photos.length === 1 ? '' : 's'}
            </h2>
            <button onClick={() => goTo('review')} className="font-medium text-rose-600 hover:text-rose-700">
              Start reviewing →
            </button>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
            {recent.slice(0, 48).map((p) => (
              <figure key={p.id} className="min-w-0">
                <img src={photoUrl(p)} alt={p.name} className="aspect-square w-full rounded-lg object-cover" />
                {p.batchName && <figcaption className="mt-1 truncate text-xs text-stone-500" title={p.batchName}>{p.batchName}</figcaption>}
              </figure>
            ))}
          </div>
          {photos.length > 48 && <p className="mt-2 text-sm text-stone-400">and {photos.length - 48} more</p>}

          <div className="mt-10 flex flex-wrap gap-3 sm:mt-16 border-t border-stone-200 pt-6 text-sm">
            <button onClick={startOver} className="rounded-full border border-stone-300 px-4 py-2 hover:bg-stone-100">
              Start over from round 1
            </button>
            <button
              onClick={deleteEverything}
              className="rounded-full border border-rose-200 px-4 py-2 text-rose-600 hover:bg-rose-50"
            >
              Delete all photos
            </button>
          </div>
        </>
      )}
    </div>
  )
}
