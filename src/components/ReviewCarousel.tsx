import { AnimatePresence, MotionConfig, motion, useIsPresent, type Transition, type Variants } from 'motion/react'
import { photoUrl, type Photo } from '../db'

export type MoveKind = 'like' | 'pass' | 'next' | 'back'

/** The last move made, so cards know which way to slide and the effects know when to play. */
export interface Move {
  kind: MoveKind
  /** Goes up with every move, so each like or pass plays its effect once. */
  seq: number
  /** Key of the card that was liked or passed. It leaves with its own animation. */
  leaving?: string
}

export interface Slide {
  key: string
  photo: Photo
}

interface Props {
  prev?: Slide
  current?: Slide
  next?: Slide
  move: Move
  onBack: () => void
  onNext: () => void
  onOpen: () => void
}

type Role = 'prev' | 'current' | 'next'

// Where each card sits. x is a share of the card's own width, so neighbours peek in from the sides.
const SLOTS = {
  prev: { x: '-92%', y: 0, scale: 0.62, rotate: 0, opacity: 0.4, filter: 'grayscale(0.7) blur(0px)' },
  current: { x: '0%', y: 0, scale: 1, rotate: 0, opacity: 1, filter: 'grayscale(0) blur(0px)' },
  next: { x: '92%', y: 0, scale: 0.62, rotate: 0, opacity: 0.4, filter: 'grayscale(0.7) blur(0px)' },
}

const SLIDE: Transition = { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 }

/**
 * The photo being reviewed, with the one before and after it peeking in greyed out.
 * Cards slide between slots when you go back or forward. A liked card pops with a
 * heart, a passed one swooshes out in a puff of cloud, and the next card takes its place.
 */
export default function ReviewCarousel({ prev, current, next, move, onBack, onNext, onOpen }: Props) {
  const slides: [Role, Slide | undefined][] = [
    ['prev', prev],
    ['current', current],
    ['next', next],
  ]

  return (
    <MotionConfig reducedMotion="user">
      <div className="absolute inset-3 sm:inset-6">
        <AnimatePresence initial={false} custom={move}>
          {slides.map(
            ([role, slide]) =>
              slide && (
                <Card
                  key={slide.key}
                  slideKey={slide.key}
                  photo={slide.photo}
                  role={role}
                  move={move}
                  onClick={role === 'prev' ? onBack : role === 'next' ? onNext : onOpen}
                />
              ),
          )}
        </AnimatePresence>
      </div>
      {move.kind === 'like' && <HeartBurst key={move.seq} />}
      {move.kind === 'pass' && <CloudPuff key={move.seq} />}
    </MotionConfig>
  )
}

function Card({ slideKey, photo, role, move, onClick }: { slideKey: string; photo: Photo; role: Role; move: Move; onClick: () => void }) {
  const isPresent = useIsPresent()
  const decided = move.kind === 'like' || move.kind === 'pass'

  // A card that wasn't on screen yet comes in from where the carousel is moving from.
  const initial =
    role === 'current'
      ? SLOTS[move.kind === 'back' ? 'prev' : 'next']
      : decided
        ? { ...SLOTS[role], opacity: 0 }
        : { ...SLOTS[role], x: role === 'prev' ? '-130%' : '130%', opacity: 0 }

  const variants: Variants = {
    exit: (m: Move) => {
      if (m.leaving === slideKey && m.kind === 'like') {
        return {
          scale: [1, 1.08, 0.4],
          y: [0, -12, -60],
          opacity: [1, 1, 0],
          transition: { duration: 0.45, times: [0, 0.3, 1], ease: 'easeOut' },
        }
      }
      if (m.leaving === slideKey && m.kind === 'pass') {
        return {
          x: '-75%',
          y: '35%',
          rotate: -16,
          scale: 0.85,
          opacity: 0,
          filter: 'grayscale(0.6) blur(8px)',
          transition: { duration: 0.42, ease: [0.55, 0, 0.85, 0.35] },
        }
      }
      // Anything else slides off the side the carousel is moving towards.
      return { x: m.kind === 'back' ? '130%' : '-130%', opacity: 0, transition: SLIDE }
    },
  }

  return (
    <motion.div
      custom={move}
      variants={variants}
      initial={initial}
      animate={SLOTS[role]}
      exit="exit"
      transition={{ ...SLIDE, opacity: { duration: 0.25, delay: decided && role !== 'current' ? 0.2 : 0 } }}
      whileHover={role === 'current' ? undefined : { opacity: 0.65 }}
      // A card on its way out stays on top of the one taking its place.
      style={{ zIndex: isPresent ? (role === 'current' ? 2 : 1) : 3 }}
      className="pointer-events-none absolute inset-y-0 left-[15%] flex w-[70%] items-center justify-center sm:left-[22%] sm:w-[56%]"
    >
      <img
        src={photoUrl(photo, 'full')}
        alt={photo.name}
        onClick={onClick}
        title={role === 'current' ? 'Full screen (F)' : role === 'prev' ? 'Back (↑)' : 'Next (↓)'}
        draggable={false}
        className={`max-h-full max-w-full rounded-2xl object-contain shadow-xl ${
          isPresent ? 'pointer-events-auto' : ''
        } ${role === 'current' ? 'cursor-zoom-in' : 'cursor-pointer'}`}
      />
    </motion.div>
  )
}

// Small hearts fly out in a ring around the big one.
const SPARKS = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2 - Math.PI / 2
  return { x: Math.cos(angle) * 150, y: Math.sin(angle) * 150, size: i % 2 ? 'text-2xl' : 'text-3xl' }
})

function HeartBurst() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <motion.span
        className="absolute text-[8rem] leading-none drop-shadow-xl"
        initial={{ scale: 0.2, opacity: 0 }}
        animate={{ scale: [0.2, 1.25, 1, 1.1], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 0.7, times: [0, 0.3, 0.6, 1], ease: 'easeOut' }}
      >
        ❤️
      </motion.span>
      {SPARKS.map((s, i) => (
        <motion.span
          key={i}
          className={`absolute leading-none ${s.size}`}
          initial={{ x: 0, y: 0, scale: 0.3, opacity: 0 }}
          animate={{ x: s.x, y: s.y, scale: [0.3, 1, 0.6], opacity: [0, 1, 0] }}
          transition={{ duration: 0.65, delay: 0.08, ease: 'easeOut' }}
        >
          ❤️
        </motion.span>
      ))}
    </div>
  )
}

// Puffs of cloud along the path the passed card leaves by (down and to the left).
const PUFFS = [
  { x: -40, y: 70, size: 110, delay: 0 },
  { x: -120, y: 110, size: 90, delay: 0.05 },
  { x: -200, y: 150, size: 120, delay: 0.1 },
  { x: -280, y: 200, size: 80, delay: 0.14 },
  { x: 30, y: 120, size: 70, delay: 0.04 },
  { x: -160, y: 50, size: 70, delay: 0.08 },
  { x: -240, y: 250, size: 100, delay: 0.16 },
]

function CloudPuff() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      {PUFFS.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-stone-300/80 blur-[3px]"
          style={{ width: p.size, height: p.size }}
          initial={{ x: p.x + 40, y: p.y - 30, scale: 0.2, opacity: 0 }}
          animate={{ x: p.x, y: p.y, scale: [0.2, 1, 1.5], opacity: [0, 0.9, 0] }}
          transition={{ duration: 0.6, delay: p.delay, ease: 'easeOut' }}
        />
      ))}
      <motion.span
        className="absolute text-7xl leading-none"
        initial={{ x: 120, y: 40, opacity: 0, scale: 0.6 }}
        animate={{ x: -220, y: 140, opacity: [0, 1, 1, 0], scale: [0.6, 1.1, 1, 0.9] }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        💨
      </motion.span>
    </div>
  )
}
