import Dexie, { type EntityTable } from 'dexie'
import { appendStickyNote, changePhotoNote, deleteStickyNote, editStickyNote, clampPosition, type StickyNote } from './photoNotes'

export interface Photo {
  id: number
  name: string
  blob: Blob
  thumb: Blob
  addedAt: number
  /** Shared by photos from one import. Older photos have no batch metadata. */
  batchId?: string
  /** Optional source/vendor name, separate from editable photo labels and groups. */
  batchName?: string
  /** Number of rounds this photo has been liked in. 0 = not reviewed yet. */
  level: number
  /** Passed on during review. */
  out: boolean
  /** The round it was passed on in. */
  outRound: number
  /** A photo can be in several groups; it's still stored once. */
  groupIds: number[]
  labels: string[]
  note: string
  /** Optional placement metadata; sticky text lives in note, without a second copy. */
  stickyNotes?: StickyNote[]
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

// v2: a photo can belong to several groups (groupId → groupIds).
db.version(2)
  .stores({})
  .upgrade((tx) =>
    tx
      .table('photos')
      .toCollection()
      .modify((p) => {
        p.groupIds = p.groupId == null ? [] : [p.groupId]
        delete p.groupId
      }),
  )

export const GROUP_COLORS = [
  '#e11d48', '#ea580c', '#ca8a04', '#16a34a', '#0891b2',
  '#2563eb', '#7c3aed', '#c026d3', '#57534e',
]

export async function createGroup(name: string) {
  const count = await db.groups.count()
  return db.groups.add({ name, color: GROUP_COLORS[count % GROUP_COLORS.length] })
}

/** The groups a photo is in, in the order the groups were made. */
export function groupsOf(photo: Photo, groups: Group[]) {
  return groups.filter((g) => photo.groupIds.includes(g.id))
}

export async function toggleGroup(photo: Photo, groupId: number) {
  const groupIds = photo.groupIds.includes(groupId)
    ? photo.groupIds.filter((id) => id !== groupId)
    : [...photo.groupIds, groupId]
  await db.photos.update(photo.id, { groupIds })
}

export async function addToGroup(ids: number[], groupId: number) {
  await db.photos
    .where('id')
    .anyOf(ids)
    .modify((p) => {
      if (!p.groupIds.includes(groupId)) p.groupIds.push(groupId)
    })
}

export async function removeFromGroup(ids: number[], groupId: number) {
  await db.photos
    .where('id')
    .anyOf(ids)
    .modify((p) => {
      p.groupIds = p.groupIds.filter((id) => id !== groupId)
    })
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

/**
 * Every photo that belongs to the current round, decided or not, in a stable
 * order so you can step back and forth through it.
 */
export function roundPhotos(photos: Photo[], round: number) {
  return photos
    .filter((p) => !p.yes && !p.theOne && (p.out ? p.outRound === round : p.level <= round))
    .sort((a, b) => a.addedAt - b.addedAt)
}

/** Not yet liked or passed in this round. */
export function isUndecided(photo: Photo, round: number) {
  return !photo.out && photo.level < round
}

export function allLabels(photos: Photo[]) {
  return [...new Set(photos.flatMap((p) => p.labels))].sort((a, b) => a.localeCompare(b))
}

/** Photos passed on, most recent round first. */
export function passedPhotos(photos: Photo[]) {
  return photos.filter((p) => p.out).sort((a, b) => b.outRound - a.outRound || a.addedAt - b.addedAt)
}

/** Pass on photos outside of review, e.g. from Liked. They count as passed in the current round. */
export async function passPhotos(ids: number[]) {
  const outRound = await getRound()
  await db.photos.where('id').anyOf(ids).modify({ out: true, outRound, yes: false, theOne: false })
}

/** Change your mind about passed photos: they count as liked in the round you passed them in. */
export async function bringBack(ids: number[]) {
  await db.photos
    .where('id')
    .anyOf(ids)
    .modify((p) => {
      p.level = Math.max(p.level, p.outRound)
      p.out = false
      p.outRound = 0
    })
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


export async function savePhotoNote(id: number, note: string) {
  await db.photos.where('id').equals(id).modify((p) => { Object.assign(p, changePhotoNote(p, note)) })
}

export async function saveStickyNote(id: number, text: string, position: { x: number; y: number }, stickyId?: string) {
  const newId = stickyId ?? crypto.randomUUID()
  await db.photos.where('id').equals(id).modify((p) => {
    Object.assign(p, stickyId ? editStickyNote(p, stickyId, text) : appendStickyNote(p, text, position, newId))
  })
}

export async function removeStickyNote(id: number, stickyId: string) {
  await db.photos.where('id').equals(id).modify((p) => { Object.assign(p, deleteStickyNote(p, stickyId)) })
}

export async function moveStickyNote(id: number, stickyId: string, position: { x: number; y: number }) {
  await db.photos.where('id').equals(id).modify((p) => {
    p.stickyNotes = p.stickyNotes?.map((s) => s.id === stickyId
      ? { ...s, x: clampPosition(position.x), y: clampPosition(position.y) } : s)
  })
}
