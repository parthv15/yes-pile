import { useEffect, useRef, useState } from 'react'

interface Props {
  files: File[]
  onConfirm: (name: string) => void
  onCancel: () => void
}

/** One naming step for file selections, folders, and drops. Nothing is saved until confirmed. */
export default function UploadDialog({ files, onConfirm, onCancel }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState('')
  const submitted = useRef(false)

  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])

  return (
    <dialog
      ref={dialog}
      aria-labelledby="upload-title"
      aria-describedby="upload-description"
      onCancel={onCancel}
      // Review shortcuts must not act on the photo behind this dialog.
      onKeyDown={(e) => e.stopPropagation()}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl bg-white p-6 text-stone-900 shadow-2xl backdrop:bg-stone-950/60 sm:p-8"
    >
      <form onSubmit={(e) => {
        e.preventDefault()
        if (submitted.current) return
        submitted.current = true
        onConfirm(name.trim())
      }}>
        <p className="text-xs font-semibold uppercase tracking-widest text-rose-600">
          {files.length} photo{files.length === 1 ? '' : 's'} ready to add
        </p>
        <h2 id="upload-title" className="mt-2 font-display text-3xl">Name this upload</h2>
        <p id="upload-description" className="mt-3 text-sm leading-relaxed text-stone-500">
          Keep track of where these photos came from. This name will appear with every photo as you review.
        </p>
        <label htmlFor="upload-name" className="mt-6 block text-sm font-medium">
          Upload name <span className="font-normal text-stone-400">(optional)</span>
        </label>
        <input
          id="upload-name"
          autoFocus
          autoComplete="off"
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Bloom & Co flowers"
          className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3 text-base outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
        />
        <p className="mt-2 text-xs text-stone-400">Leave blank to add photos without a name.</p>
        <div className="mt-8 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onCancel} className="min-h-11 rounded-full border border-stone-300 px-5 py-3 text-sm font-medium hover:bg-stone-100">
            Cancel
          </button>
          <button type="submit" className="min-h-11 rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white hover:bg-stone-700">
            Add {files.length} photo{files.length === 1 ? '' : 's'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
