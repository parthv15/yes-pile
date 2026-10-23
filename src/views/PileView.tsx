import { useState } from 'react'
import {
  addToGroup,
  allLabels,
  createGroup,
  db,
  deleteGroup as removeGroup,
  deletePhotos,
  groupsOf,
  likedPhotos,
  passPhotos,
  removeFromGroup,
  updateVerdicts,
  type Group,
  type Photo,
  type VerdictState,
} from '../db'
import { useDecision } from '../decision'
import PhotoCard from '../components/PhotoCard'
import PhotoModal from '../components/PhotoModal'

interface Props {
  photos: Photo[]
  groups: Group[]
  round: number
}

const UNGROUPED = -1

export default function PileView({ photos, groups }: Props) {
  const [labelFilter, setLabelFilter] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [openId, setOpenId] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)
  const [bulkLabel, setBulkLabel] = useState('')
  const { board, decision } = useDecision()

  const labels = allLabels(photos)
  const liked = likedPhotos(photos)
    .filter((p) => !labelFilter || p.labels.includes(labelFilter))
    .sort((a, b) => Number(b.theOne) - Number(a.theOne) || Number(b.yes) - Number(a.yes) || b.level - a.level || a.addedAt - b.addedAt)

  const sections = [
    ...groups.map((g) => ({ id: g.id, group: g as Group | undefined, photos: liked.filter((p) => p.groupIds.includes(g.id)) })),
    { id: UNGROUPED, group: undefined, photos: liked.filter((p) => groupsOf(p, groups).length === 0) },
  ]
  // Order used for prev/next in the photo viewer. A photo in several groups appears once.
  const ordered = [...new Set(sections.flatMap((s) => s.photos))]
  const openIndex = ordered.findIndex((p) => p.id === openId)
  const openPhoto = photos.find((p) => p.id === openId)

  const toggle = (id: number) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  async function bulk(changes: Partial<VerdictState>) {
    await updateVerdicts(decision.id, [...selected], changes)
    setSelected(new Set())
  }

  async function deleteSelected() {
    if (!confirm(`Delete ${selected.size} photo${selected.size === 1 ? '' : 's'} for good? ${selected.size === 1 ? 'It' : 'They'}'ll be gone from every decision in ${board.name}.`)) return
    await deletePhotos([...selected])
    setSelected(new Set())
  }

  async function bulkAddLabel() {
    const label = bulkLabel.trim()
    if (!label) return
    await db.photos
      .where('id')
      .anyOf([...selected])
      .modify((p) => {
        if (!p.labels.includes(label)) p.labels.push(label)
      })
    setBulkLabel('')
  }

  async function newGroup() {
    const name = prompt('Name the new group (e.g. "Florals" or "Studio Aurora")')?.trim()
    if (!name) return
    const id = await createGroup(decision.id, name)
    if (selected.size) {
      await addToGroup(decision.id, [...selected], id)
      setSelected(new Set())
    }
  }

  async function renameGroup(g: Group) {
    const name = prompt('Rename group', g.name)?.trim()
    if (name) await db.groups.update(g.id, { name })
  }

  async function deleteGroup(g: Group) {
    if (!confirm(`Delete the group "${g.name}"? Its photos stay, just not in this group.`)) return
    await removeGroup(g)
  }

  function dragStart(e: React.DragEvent, photo: Photo) {
    const ids = selected.has(photo.id) ? [...selected] : [photo.id]
    e.dataTransfer.setData('application/x-yes-pile', JSON.stringify(ids))
    e.dataTransfer.effectAllowed = 'copy'
  }

  function dropProps(sectionId: number) {
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes('application/x-yes-pile')) return
        e.preventDefault()
        e.stopPropagation()
        setDropTarget(sectionId)
      },
      onDragLeave: () => setDropTarget((t) => (t === sectionId ? null : t)),
      onDrop: (e: React.DragEvent) => {
        const data = e.dataTransfer.getData('application/x-yes-pile')
        if (!data) return
        e.preventDefault()
        e.stopPropagation()
        setDropTarget(null)
        const ids: number[] = JSON.parse(data)
        // Dropping on a group adds it there (it stays in its other groups too).
        // Dropping on "Not grouped" takes it out of every group.
        if (sectionId === UNGROUPED) updateVerdicts(decision.id, ids, { groupIds: [] })
        else addToGroup(decision.id, ids, sectionId)
      },
    }
  }

  if (liked.length === 0 && !labelFilter) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="font-display text-3xl">No liked photos yet</p>
        <p className="mt-2 text-stone-500">Photos you like during review land here.</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-stone-200 bg-stone-50/95 px-4 py-3 sm:px-8 backdrop-blur">
        {selected.size > 0 ? (
          <>
            <span className="mr-2 text-sm font-medium">{selected.size} selected</span>
            <select
              value=""
              onChange={(e) => {
                const [action, id] = e.target.value.split(':')
                if (action === 'new') newGroup()
                else if (action === 'none') bulk({ groupIds: [] })
                else {
                  const run = action === 'add' ? addToGroup : removeFromGroup
                  run(decision.id, [...selected], Number(id)).then(() => setSelected(new Set()))
                }
              }}
              className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm"
            >
              <option value="" disabled>
                Groups…
              </option>
              <optgroup label="Add to">
                {groups.map((g) => (
                  <option key={g.id} value={`add:${g.id}`}>
                    {g.name}
                  </option>
                ))}
                <option value="new">+ New group…</option>
              </optgroup>
              {groups.length > 0 && (
                <optgroup label="Remove from">
                  {groups.map((g) => (
                    <option key={g.id} value={`remove:${g.id}`}>
                      {g.name}
                    </option>
                  ))}
                  <option value="none">All groups</option>
                </optgroup>
              )}
            </select>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                bulkAddLabel()
              }}
            >
              <input
                value={bulkLabel}
                onChange={(e) => setBulkLabel(e.target.value)}
                placeholder="Add label…"
                list="all-labels"
                className="w-36 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-stone-900"
              />
              <datalist id="all-labels">
                {labels.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </form>
            <button onClick={() => bulk({ yes: true, out: false })} className="rounded-full bg-stone-900 px-3 py-1.5 text-sm text-white">
              Add to Yes Pile
            </button>
            <button
              onClick={() => passPhotos(decision, [...selected]).then(() => setSelected(new Set()))}
              className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-100"
            >
              Pass
            </button>
            <button onClick={deleteSelected} className="rounded-full px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50">
              Delete
            </button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-sm text-stone-500 hover:text-stone-900">
              Clear selection
            </button>
          </>
        ) : (
          <>
            <span className="mr-2 text-sm text-stone-500">
              {liked.length} liked <span className="sm:hidden">· Tick photos for group actions</span><span className="hidden sm:inline">· Shift-click or tick to select · drag onto a group to add it there</span>
            </span>
            {labels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {labels.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLabelFilter(labelFilter === l ? null : l)}
                    className={`rounded-full px-3 py-1 text-xs ${
                      labelFilter === l ? 'bg-stone-900 text-white' : 'bg-white ring-1 ring-stone-200 hover:ring-stone-400'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
            <button onClick={newGroup} className="ml-auto rounded-full bg-stone-900 px-4 py-1.5 text-sm font-medium text-white">
              + New group
            </button>
          </>
        )}
      </div>

      <div className="flex flex-col gap-5 px-2 py-4 sm:gap-8 sm:px-8 sm:py-6">
        {sections.map(({ id, group, photos: sectionPhotos }) => {
          if (!group && sectionPhotos.length === 0) return null
          return (
            <section
              key={id}
              {...dropProps(id)}
              className={`rounded-2xl p-2 transition sm:p-4 ${dropTarget === id ? 'bg-rose-50 ring-2 ring-rose-300' : ''}`}
            >
              <div className="mb-3 flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="h-3 w-3 rounded-full" style={{ background: group?.color ?? '#a8a29e' }} />
                <h2 className="min-w-0 break-words font-display text-xl">{group?.name ?? (groups.length ? 'Not grouped yet' : 'All liked')}</h2>
                <span className="text-sm text-stone-400">{sectionPhotos.length}</span>
                {group && (
                  <div className="ml-2 flex gap-2 text-xs text-stone-400">
                    <button onClick={() => renameGroup(group)} className="hover:text-stone-900">
                      Rename
                    </button>
                    <button onClick={() => deleteGroup(group)} className="hover:text-rose-600">
                      Delete
                    </button>
                  </div>
                )}
              </div>
              {sectionPhotos.length === 0 ? (
                <p className="rounded-xl border-2 border-dashed border-stone-200 py-8 text-center text-sm text-stone-400">
                  Drag photos here
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
                  {sectionPhotos.map((p) => (
                    <PhotoCard
                      key={p.id}
                      photo={p}
                      groups={groupsOf(p, groups).filter((g) => g.id !== id)}
                      onRemoveFromGroup={group ? () => removeFromGroup(decision.id, [p.id], group.id) : undefined}
                      selected={selected.has(p.id)}
                      onOpen={() => setOpenId(p.id)}
                      onToggleSelect={() => toggle(p.id)}
                      draggable
                      onDragStart={(e) => dragStart(e, p)}
                    />
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>

      {openPhoto && (
        <PhotoModal
          photo={openPhoto}
          groups={groups}
          labels={labels}
          onClose={() => setOpenId(null)}
          onPrev={openIndex > 0 ? () => setOpenId(ordered[openIndex - 1].id) : undefined}
          onNext={openIndex >= 0 && openIndex < ordered.length - 1 ? () => setOpenId(ordered[openIndex + 1].id) : undefined}
        />
      )}
    </div>
  )
}
