import Dexie, { type EntityTable } from 'dexie'

export interface Photo {
  id: number
  name: string
  blob: Blob
  thumb: Blob
  addedAt: number
  /** Number of rounds this photo has been liked in. 0 = not reviewed yet. */
  level: number
  /** Passed on during review. */
  out: boolean
  /** The round it was passed on in. */
  outRound: number
  groupId: number | null
  labels: string[]
  note: string
  yes: boolean
  theOne: boolean
}

export interface Group {
  id: number
  name: string
  color: string
}

interface Meta {
  key: string
  value: number
}

export const db = new Dexie('yes-pile') as Dexie & {
  photos: EntityTable<Photo, 'id'>
  groups: EntityTable<Group, 'id'>
  meta: EntityTable<Meta, 'key'>
}

db.version(1).stores({
  photos: '++id, addedAt',
  groups: '++id',
  meta: 'key',
})

export const GROUP_COLORS = [
  '#e11d48', '#ea580c', '#ca8a04', '#16a34a', '#0891b2',
  '#2563eb', '#7c3aed', '#c026d3', '#57534e',
]

export async function createGroup(name: string) {
  const count = await db.groups.count()
  return db.groups.add({ name, color: GROUP_COLORS[count % GROUP_COLORS.length] })
}

export async function getRound(): Promise<number> {
  return (await db.meta.get('round'))?.value ?? 1
}

export async function setRound(value: number) {
  await db.meta.put({ key: 'round', value })
}

/** Photos still in the running for the current round, oldest round first. */
export function reviewQueue(photos: Photo[], round: number) {
  return photos
    .filter((p) => !p.out && !p.yes && !p.theOne && p.level < round)
    .sort((a, b) => a.level - b.level || a.addedAt - b.addedAt)
}

/** Photos liked at least once and not passed on. */
export function likedPhotos(photos: Photo[]) {
  return photos.filter((p) => !p.out && p.level > 0)
}

/** How far through the current round you are. */
export function roundProgress(photos: Photo[], round: number) {
  const liked = photos.filter((p) => !p.out && p.level >= round).length
  const passed = photos.filter((p) => p.out && p.outRound === round).length
  const left = reviewQueue(photos, round).length
  return { liked, passed, left, total: liked + passed + left }
}

export function allLabels(photos: Photo[]) {
  return [...new Set(photos.flatMap((p) => p.labels))].sort((a, b) => a.localeCompare(b))
}

export async function makeTheOne(id: number) {
  await db.transaction('rw', db.photos, async () => {
    await db.photos.filter((p) => p.theOne).modify({ theOne: false, yes: true })
    await db.photos.update(id, { theOne: true, out: false })
  })
}

export async function deletePhotos(ids: number[]) {
  await db.photos.bulkDelete(ids)
  ids.forEach(forgetUrls)
}

// Object URLs are cached per photo so images don't reload whenever the
// database changes. A photo's blobs never change, so the cache never goes stale.
const urlCache = new Map<string, string>()

export function photoUrl(photo: Photo, kind: 'thumb' | 'full' = 'thumb') {
  const key = `${photo.id}:${kind}`
  let url = urlCache.get(key)
  if (!url) {
    url = URL.createObjectURL(kind === 'thumb' ? photo.thumb : photo.blob)
    urlCache.set(key, url)
  }
  return url
}

function forgetUrls(id: number) {
  for (const kind of ['thumb', 'full']) {
    const key = `${id}:${kind}`
    const url = urlCache.get(key)
    if (url) URL.revokeObjectURL(url)
    urlCache.delete(key)
  }
}
