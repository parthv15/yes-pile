import Dexie, { type EntityTable } from 'dexie'
import { appendStickyNote, changePhotoNote, deleteStickyNote, editStickyNote, clampPosition, type StickyNote } from './photoNotes'

/** A set of photos you're choosing from, like "Our wedding". Each board holds several decisions. */
export interface Board {
  id: number
  name: string
  createdAt: number
}

/** One choice made from a board's photos, like "Mehendi outfit": its own rounds, groups and THE ONE. */
export interface Decision {
  id: number
  boardId: number
  name: string
  createdAt: number
  round: number
}

/** A photo as stored: the file and what's true of it whichever decision you're in. */
export interface StoredPhoto {
  id: number
  boardId: number
  name: string
  blob: Blob
  thumb: Blob
  addedAt: number
  /** Shared by photos from one import. Older photos have no batch metadata. */
  batchId?: string
  /** Optional source/vendor name, separate from editable photo labels and groups. */
  batchName?: string
  labels: string[]
  note: string
  /** Optional placement metadata; sticky text lives in note, without a second copy. */
  stickyNotes?: StickyNote[]
}

/** What one decision has made of a photo. */
export interface VerdictState {
  /** Number of rounds this photo has been liked in. 0 = not reviewed yet. */
  level: number
  /** Passed on during review. */
  out: boolean
  /** The round it was passed on in. */
  outRound: number
  /** A photo can be in several groups; it's still stored once. */
  groupIds: number[]
  yes: boolean
  theOne: boolean
}

/** A decision's verdict on a photo. A photo with no verdict yet hasn't been looked at in that decision. */
export interface Verdict extends VerdictState {
  decisionId: number
  photoId: number
}

/** A photo as seen in the decision you're working on. */
export type Photo = StoredPhoto & VerdictState

export interface Group {
  id: number
  decisionId: number
  name: string
  color: string
}

export const db = new Dexie('yes-pile') as Dexie & {
  boards: EntityTable<Board, 'id'>
  decisions: EntityTable<Decision, 'id'>
  photos: EntityTable<StoredPhoto, 'id'>
  verdicts: Dexie.Table<Verdict, [number, number]>
  groups: EntityTable<Group, 'id'>
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

// v3: boards and decisions. Photos belong to a board; how each decision has judged
// a photo moves into verdicts. Photos from before boards land in one board and decision.
db.version(3)
  .stores({
    boards: '++id',
    decisions: '++id, boardId',
    photos: '++id, addedAt, boardId',
    verdicts: '[decisionId+photoId], decisionId, photoId',
    groups: '++id, decisionId',
  })
  .upgrade(async (tx) => {
    const photos = await tx.table('photos').toArray()
    const groups = await tx.table('groups').toArray()
    if (!photos.length && !groups.length) return
    const now = Date.now()
    const round = (await tx.table('meta').get('round'))?.value ?? 1
    const boardId = await tx.table('boards').add({ name: 'My board', createdAt: now })
    const decisionId = await tx.table('decisions').add({ boardId, name: 'First decision', createdAt: now, round })
    await tx.table('verdicts').bulkAdd(
      photos.map((p) => ({
        decisionId,
        photoId: p.id,
        level: p.level ?? 0,
        out: p.out ?? false,
        outRound: p.outRound ?? 0,
        groupIds: p.groupIds ?? [],
        yes: p.yes ?? false,
        theOne: p.theOne ?? false,
      })),
    )
    await tx
      .table('photos')
      .toCollection()
      .modify((p) => {
        p.boardId = boardId
        for (const key of ['level', 'out', 'outRound', 'groupIds', 'yes', 'theOne']) delete p[key]
      })
    await tx.table('groups').toCollection().modify((g) => {
      g.decisionId = decisionId
    })
  })

// v4: the round counter now lives on each decision.
db.version(4).stores({ meta: null })

const FRESH: VerdictState = { level: 0, out: false, outRound: 0, groupIds: [], yes: false, theOne: false }

/** The board's photos as the decision sees them. Photos it hasn't judged yet come in fresh. */
export function withVerdicts(photos: StoredPhoto[], verdicts: Verdict[]): Photo[] {
  const byPhoto = new Map(verdicts.map((p) => [p.photoId, p]))
  return photos.map((photo) => {
    const verdict = byPhoto.get(photo.id)
    return {
      ...photo,
      level: verdict?.level ?? FRESH.level,
      out: verdict?.out ?? FRESH.out,
      outRound: verdict?.outRound ?? FRESH.outRound,
      groupIds: verdict?.groupIds ?? FRESH.groupIds,
      yes: verdict?.yes ?? FRESH.yes,
      theOne: verdict?.theOne ?? FRESH.theOne,
    }
  })
}

/** Change what a decision has made of some photos, creating their verdicts if needed. */
export async function updateVerdicts(
  decisionId: number,
  photoIds: number[],
  change: Partial<VerdictState> | ((verdict: VerdictState) => void),
) {
  await db.transaction('rw', db.verdicts, async () => {
    const keys = photoIds.map((photoId): [number, number] => [decisionId, photoId])
    const existing = await db.verdicts.bulkGet(keys)
    const verdicts = photoIds.map((photoId, i) => {
      const verdict: Verdict = { ...FRESH, groupIds: [...FRESH.groupIds], ...existing[i], decisionId, photoId }
      if (typeof change === 'function') change(verdict)
      else Object.assign(verdict, change)
      return verdict
    })
    await db.verdicts.bulkPut(verdicts)
  })
}

/** Update what's true of photos in every decision: labels, notes and the like. */
export async function updatePhoto(id: number, changes: Partial<Pick<StoredPhoto, 'labels' | 'note' | 'name'>>) {
  await db.photos.update(id, changes)
}

export async function createBoard(name: string) {
  return db.boards.add({ name, createdAt: Date.now() } as Board)
}

export async function createDecision(boardId: number, name: string) {
  return db.decisions.add({ boardId, name, createdAt: Date.now(), round: 1 } as Decision)
}

/** A board, its photos, and every decision made from them. */
export async function deleteBoard(boardId: number) {
  const decisionIds = await db.decisions.where('boardId').equals(boardId).primaryKeys()
  await Promise.all(decisionIds.map(deleteDecision))
  await deletePhotos(await db.photos.where('boardId').equals(boardId).primaryKeys())
  await db.boards.delete(boardId)
}

/** A decision and its verdicts and groups. The board's photos stay. */
export async function deleteDecision(decisionId: number) {
  await db.transaction('rw', db.decisions, db.verdicts, db.groups, async () => {
    await db.verdicts.where('decisionId').equals(decisionId).delete()
    await db.groups.where('decisionId').equals(decisionId).delete()
    await db.decisions.delete(decisionId)
  })
}

/** Put every photo back in the running for this decision, from round 1. Groups are kept. */
export async function startDecisionOver(decisionId: number) {
  await db.transaction('rw', db.decisions, db.verdicts, async () => {
    await db.verdicts.where('decisionId').equals(decisionId).modify({ level: 0, out: false, outRound: 0, yes: false, theOne: false })
    await db.decisions.update(decisionId, { round: 1 })
  })
}

export const GROUP_COLORS = [
  '#e11d48', '#ea580c', '#ca8a04', '#16a34a', '#0891b2',
  '#2563eb', '#7c3aed', '#c026d3', '#57534e',
]

export async function createGroup(decisionId: number, name: string) {
  const count = await db.groups.where('decisionId').equals(decisionId).count()
  return db.groups.add({ decisionId, name, color: GROUP_COLORS[count % GROUP_COLORS.length] } as Group)
}

/** The groups a photo is in, in the order the groups were made. */
export function groupsOf(photo: Photo, groups: Group[]) {
  return groups.filter((g) => photo.groupIds.includes(g.id))
}

export async function toggleGroup(decisionId: number, photo: Photo, groupId: number) {
  await updateVerdicts(decisionId, [photo.id], (p) => {
    p.groupIds = p.groupIds.includes(groupId) ? p.groupIds.filter((id) => id !== groupId) : [...p.groupIds, groupId]
  })
}

export async function addToGroup(decisionId: number, ids: number[], groupId: number) {
  await updateVerdicts(decisionId, ids, (p) => {
    if (!p.groupIds.includes(groupId)) p.groupIds = [...p.groupIds, groupId]
  })
}

export async function removeFromGroup(decisionId: number, ids: number[], groupId: number) {
  await updateVerdicts(decisionId, ids, (p) => {
    p.groupIds = p.groupIds.filter((id) => id !== groupId)
  })
}

export async function deleteGroup(group: Group) {
  await db.transaction('rw', db.verdicts, db.groups, async () => {
    await db.verdicts.where('decisionId').equals(group.decisionId).modify((p) => {
      p.groupIds = p.groupIds.filter((id) => id !== group.id)
    })
    await db.groups.delete(group.id)
  })
}

export async function setRound(decisionId: number, round: number) {
  await db.decisions.update(decisionId, { round })
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
export async function passPhotos(decision: Decision, ids: number[]) {
  await updateVerdicts(decision.id, ids, { out: true, outRound: decision.round, yes: false, theOne: false })
}

/** Change your mind about passed photos: they count as liked in the round you passed them in. */
export async function bringBack(decisionId: number, ids: number[]) {
  await updateVerdicts(decisionId, ids, (p) => {
    p.level = Math.max(p.level, p.outRound)
    p.out = false
    p.outRound = 0
  })
}

export async function makeTheOne(decisionId: number, photoId: number) {
  await db.transaction('rw', db.verdicts, async () => {
    await db.verdicts
      .where('decisionId')
      .equals(decisionId)
      .filter((p) => p.theOne)
      .modify({ theOne: false, yes: true })
    await updateVerdicts(decisionId, [photoId], { theOne: true, out: false })
  })
}

/** Delete photos from their board, and from every decision made from it. */
export async function deletePhotos(ids: number[]) {
  await db.transaction('rw', db.photos, db.verdicts, async () => {
    await db.verdicts.where('photoId').anyOf(ids).delete()
    await db.photos.bulkDelete(ids)
  })
  ids.forEach(forgetUrls)
}

// Object URLs are cached per photo so images don't reload whenever the
// database changes. A photo's blobs never change, so the cache never goes stale.
const urlCache = new Map<string, string>()

export function photoUrl(photo: StoredPhoto, kind: 'thumb' | 'full' = 'thumb') {
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
