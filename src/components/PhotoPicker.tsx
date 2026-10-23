import { useRef } from 'react'

/** Buttons to choose photos or a whole folder from the device. */
export default function PhotoPicker({ onFiles, className = '' }: { onFiles: (files: File[]) => void; className?: string }) {
  const filesInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    onFiles([...(e.target.files ?? [])])
    e.target.value = ''
  }

  return (
    <div className={`flex flex-col gap-3 sm:flex-row ${className}`}>
      <button
        onClick={() => filesInput.current?.click()}
        className="rounded-full bg-stone-900 px-6 py-3 font-medium text-white hover:bg-stone-700"
      >
        Choose photos
      </button>
      <button
        onClick={() => folderInput.current?.click()}
        className="rounded-full border border-stone-300 bg-white px-6 py-3 font-medium hover:bg-stone-100"
      >
        Choose a folder
      </button>
      <input ref={filesInput} type="file" accept="image/*" multiple hidden onChange={pick} />
      <input ref={folderInput} type="file" hidden {...{ webkitdirectory: '' }} onChange={pick} />
    </div>
  )
}
