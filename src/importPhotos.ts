import { db } from './db'

const THUMB_SIZE = 600

async function makeThumb(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, THUMB_SIZE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('thumbnail failed'))), 'image/jpeg', 0.82),
  )
}

export interface ImportResult {
  added: number
  failed: string[]
}

export async function importPhotos(
  files: File[],
  onProgress: (done: number, total: number) => void,
): Promise<ImportResult> {
  const images = files.filter((f) => f.type.startsWith('image/'))
  const failed: string[] = []
  let added = 0
  for (const [i, file] of images.entries()) {
    try {
      const thumb = await makeThumb(file)
      await db.photos.add({
        name: file.name,
        blob: file,
        thumb,
        addedAt: Date.now() + i,
        level: 0,
        out: false,
        outRound: 0,
        groupIds: [],
        labels: [],
        note: '',
        yes: false,
        theOne: false,
      })
      added++
    } catch {
      failed.push(file.name)
    }
    onProgress(i + 1, images.length)
  }
  return { added, failed }
}
