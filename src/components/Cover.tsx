import { photoUrl, type StoredPhoto } from '../db'

/** A card's cover: up to four photos tiled together, or a soft placeholder when there are none. */
export default function Cover({ photos, empty }: { photos: StoredPhoto[]; empty: string }) {
  const shown = photos.slice(0, 4)

  if (shown.length === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center bg-stone-100 px-6 text-center text-sm text-stone-400">
        {empty}
      </div>
    )
  }

  // 1 photo fills the cover; 2 sit side by side; 3 put the first one tall on the left; 4 make a grid.
  const layout = ['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-2 grid-rows-2', 'grid-cols-2 grid-rows-2'][shown.length]
  return (
    <div className={`grid aspect-[4/3] gap-0.5 overflow-hidden bg-stone-100 ${layout}`}>
      {shown.map((p, i) => (
        <img
          key={p.id}
          src={photoUrl(p)}
          alt=""
          draggable={false}
          className={`h-full w-full object-cover ${shown.length === 3 && i === 0 ? 'row-span-2' : ''}`}
        />
      ))}
    </div>
  )
}
