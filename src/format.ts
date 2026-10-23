/** "1 photo", "3 photos". */
export function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}
