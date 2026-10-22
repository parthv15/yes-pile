import { photoUrl, type Group, type Photo } from '../db'

interface Props {
  photo: Photo
  group?: Group
  selected?: boolean
  onOpen: () => void
  onToggleSelect?: () => void
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
  dimmed?: boolean
}

export default function PhotoCard({ photo, group, selected, onOpen, onToggleSelect, draggable, onDragStart, dimmed }: Props) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={(e) => (e.shiftKey && onToggleSelect ? onToggleSelect() : onOpen())}
      className={`group relative cursor-pointer overflow-hidden rounded-xl bg-stone-200 ring-offset-2 transition ${
        selected ? 'ring-3 ring-stone-900' : 'hover:ring-2 hover:ring-stone-300'
      } ${dimmed ? 'opacity-50 grayscale hover:opacity-100 hover:grayscale-0' : ''}`}
    >
      <img src={photoUrl(photo)} alt={photo.name} className="aspect-[4/5] w-full object-cover" draggable={false} />

      {onToggleSelect && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleSelect()
          }}
          className={`absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs text-white transition ${
            selected
              ? 'border-stone-900 bg-stone-900'
              : 'border-white bg-black/20 opacity-0 group-hover:opacity-100'
          }`}
        >
          {selected && '✓'}
        </button>
      )}

      <div className="absolute top-2 right-2 flex gap-1">
        {photo.theOne && (
          <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white shadow">THE ONE</span>
        )}
        {photo.yes && !photo.theOne && (
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-rose-600 shadow">Yes</span>
        )}
        {photo.level > 1 && (
          <span className="rounded-full bg-black/50 px-2 py-0.5 text-xs text-white" title={`Liked in ${photo.level} rounds`}>
            ♥ {photo.level}
          </span>
        )}
      </div>

      {(group || photo.labels.length > 0 || photo.note) && (
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 pt-6">
          {group && (
            <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: group.color }}>
              {group.name}
            </span>
          )}
          {photo.labels.map((l) => (
            <span key={l} className="rounded-full bg-white/90 px-2 py-0.5 text-xs">
              {l}
            </span>
          ))}
          {photo.note && <span className="text-xs text-white" title={photo.note}>✎</span>}
        </div>
      )}
    </div>
  )
}
