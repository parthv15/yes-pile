import { useEffect, useRef, useState } from 'react'

const FADE = '24px'

/**
 * A row that scrolls sideways when its items don't fit, fading out whichever
 * edge has more to scroll to, so it's clear there's more.
 */
export default function ScrollRow({ className = '', children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: false, end: false })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () =>
      setEdges({
        start: el.scrollLeft > 1,
        end: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      })
    update()
    el.addEventListener('scroll', update, { passive: true })
    // The row resizing, or items being added, removed or renamed, can change what overflows.
    const resizes = new ResizeObserver(update)
    resizes.observe(el)
    const mutations = new MutationObserver(update)
    mutations.observe(el, { childList: true, subtree: true, characterData: true })
    return () => {
      el.removeEventListener('scroll', update)
      resizes.disconnect()
      mutations.disconnect()
    }
  }, [])

  const mask = `linear-gradient(to right, ${edges.start ? 'transparent' : 'black'}, black ${FADE}, black calc(100% - ${FADE}), ${
    edges.end ? 'transparent' : 'black'
  })`

  return (
    <div
      ref={ref}
      className={`flex min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      style={edges.start || edges.end ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
    >
      {children}
    </div>
  )
}
