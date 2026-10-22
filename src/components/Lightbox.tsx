import { useEffect, useRef, useState } from 'react'

interface Props {
  src: string
  alt: string
  batchName?: string
  onClose: () => void
}

/**
 * Shows a photo across the whole screen. Click the photo to switch between
 * fitting the window and its actual size. Esc, F or the ✕ closes it.
 * Other keys pass through, so you can keep liking or flipping photos while it's open.
 */
export default function Lightbox({ src, alt, batchName, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [actualSize, setActualSize] = useState(false)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [view, setView] = useState({ w: window.innerWidth, h: window.innerHeight })
  // Parents pass a new onClose each render; keep the latest without re-running effects.
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const el = ref.current
    el?.requestFullscreen?.().catch(() => {})
    // Leaving browser full screen (e.g. with Esc) closes the viewer too.
    function onFullscreenChange() {
      if (!document.fullscreenElement) closeRef.current()
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // A dropped upload can open its naming dialog above the full-screen viewer.
      if (e.target instanceof Element && e.target.closest('dialog[open]')) return
      if (e.key !== 'Escape' && e.key !== 'f') return
      e.preventDefault()
      e.stopImmediatePropagation()
      closeRef.current()
    }
    // Capture phase, so Esc closes this before anything underneath sees it.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  useEffect(() => {
    const onResize = () => setView({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // A new photo (e.g. after liking one) starts fitted to the window again.
  useEffect(() => {
    setActualSize(false)
    setNatural(null)
  }, [src])

  // Scale the photo up or down to exactly fit the window, so clicks beside it reach the background.
  const scale = natural ? Math.min(view.w / natural.w, view.h / natural.h) : 1
  const zoomable = !!natural && scale < 1

  return (
    <div
      ref={ref}
      className={`fixed inset-0 z-[60] bg-black ${actualSize ? 'overflow-auto' : 'flex items-center justify-center'}`}
      // Stop here so a click doesn't also close a viewer this sits inside.
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
    >
      <img
        src={src}
        alt={alt}
        onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        style={actualSize || !natural ? undefined : { width: natural.w * scale, height: natural.h * scale }}
        onClick={(e) => {
          e.stopPropagation()
          if (zoomable) setActualSize(!actualSize)
        }}
        className={
          actualSize
            ? 'm-auto block max-w-none cursor-zoom-out'
            : `max-w-none ${zoomable ? 'cursor-zoom-in' : 'cursor-default'}`
        }
      />
      {batchName && (
        <p className="pointer-events-none fixed top-[max(1rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))] max-w-[calc(100%-6rem)] truncate rounded-full bg-black/70 px-3 py-2 text-sm text-white" title={batchName}>
          <span className="text-white/70">Upload: </span>{batchName}
        </p>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label="Close full screen"
        className="fixed top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/25"
        title="Close (Esc)"
      >
        ✕
      </button>
      {zoomable && (
        <p className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white/70">
          Click the photo to see it at {actualSize ? 'window size' : 'actual size'}
        </p>
      )}
    </div>
  )
}
