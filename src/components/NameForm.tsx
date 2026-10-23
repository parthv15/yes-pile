import { useState } from 'react'

interface Props {
  label: string
  placeholder: string
  submitLabel: string
  onSubmit: (name: string) => void
  onCancel?: () => void
}

/** A one-line form for naming something new, like a board or a decision. */
export default function NameForm({ label, placeholder, submitLabel, onSubmit, onCancel }: Props) {
  const [name, setName] = useState('')

  return (
    <form
      className="flex w-full flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) onSubmit(name.trim())
      }}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onCancel?.()}
        aria-label={label}
        placeholder={placeholder}
        maxLength={80}
        className="min-w-0 flex-1 rounded-full border border-stone-300 bg-white px-4 py-2.5 outline-none focus:border-stone-900"
      />
      <button
        type="submit"
        disabled={!name.trim()}
        className="shrink-0 rounded-full bg-stone-900 px-5 py-2.5 font-medium text-white hover:bg-stone-700 disabled:opacity-40 disabled:hover:bg-stone-900"
      >
        {submitLabel}
      </button>
    </form>
  )
}
