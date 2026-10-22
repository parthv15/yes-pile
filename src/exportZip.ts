import JSZip from 'jszip'
import { groupsOf, type Group, type Photo } from './db'

function safe(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'untitled'
}

/** Download THE ONE and the Yes Pile as a zip, foldered by group, with a notes file. */
export async function exportYesPile(photos: Photo[], groups: Group[]) {
  const zip = new JSZip()
  const notes: string[] = []

  for (const p of photos) {
    const names = groupsOf(p, groups).map((g) => g.name)
    // A photo in several groups goes in the first group's folder; notes.txt lists them all.
    const folder = p.theOne ? '' : `${safe(names[0] ?? 'Yes Pile')}/`
    const file = p.theOne ? `THE ONE - ${safe(p.name)}` : safe(p.name)
    zip.file(folder + file, p.blob)
    const details = [names.join(', '), p.labels.join(', '), p.note].filter(Boolean).join(' | ')
    notes.push(`${p.theOne ? '❤️ THE ONE ❤️  ' : ''}${folder}${file}${details ? `\n    ${details}` : ''}`)
  }
  zip.file('notes.txt', notes.join('\n\n'))

  const blob = await zip.generateAsync({ type: 'blob' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'yes-pile.zip'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}
