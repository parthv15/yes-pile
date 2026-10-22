# Yes Pile ❤️

Go from a hundred options down to **THE ONE**.

Built for sorting through wedding vendor photos, but it works for any pile of pictures you need to narrow down.

**Live:** https://parthv15.github.io/yes-pile/

## How it works

1. **Add photos.** Drop them anywhere on the page, or choose files or a whole folder.
2. **Review in rounds.** Like or pass on each photo. When a round is done, start the next one with only the photos you liked. Repeat until you're down to a few.
3. **Group and label.** In **Liked**, sort photos into groups. A photo can be in several groups at once; it's still one photo, so liking, labelling or picking it shows everywhere. Drag a photo onto a group to add it there, or select several and use **Groups…**. Add labels and notes too.
4. **Decide.** Open a photo and choose **THE ONE!** or **Add to Yes Pile**.
5. **Keep it.** The **Yes Pile** tab shows THE ONE and everything else you said yes to. Download it all as a zip.

### Keyboard shortcuts while reviewing

| Key | Action |
| --- | --- |
| `→` or `L` | Like |
| `←` or `P` | Pass |
| `↓` or `M` | Maybe: skip for now (or Next on a photo you've already decided) |
| `↑` or `B` | Back to the previous photo |
| `Z` or `Backspace` | Undo |
| `F` | Full screen (click the photo there to see it at actual size; `Esc` to close) |
| `1`–`9` | Put the photo in that group |

## Where your photos live

Everything is stored in your browser (IndexedDB). Nothing is uploaded, and there's no account. Photos stay on the device and browser you added them in, and clearing your browser's site data deletes them. Use **Download as zip** to keep a copy of your Yes Pile.

## Development

```sh
npm install
npm run dev
```

React + Vite + TypeScript, Tailwind CSS, and Dexie for storage. Every push to `main` deploys to GitHub Pages.
