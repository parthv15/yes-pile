import type { Board, Decision } from '../db'
import { routeToHash } from '../route'

interface Props {
  board?: Board
  decision?: Decision
  /** The decision's tabs, when inside one. */
  nav?: React.ReactNode
  /** Upload progress, shown at the end of the header. */
  status?: React.ReactNode
}

/** The top of every page: the app's name, where you are, and the tabs for a decision. */
export default function AppHeader({ board, decision, nav, status }: Props) {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-stone-200 bg-white px-4 py-3 sm:flex-nowrap sm:gap-x-8 sm:px-8 sm:py-4">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
        <a href={routeToHash({ page: 'boards' })} className="shrink-0 font-display text-xl font-bold tracking-tight sm:text-2xl">
          Yes Pile ❤️
        </a>
        {board && (
          <>
            <Separator />
            {decision ? (
              <a
                href={routeToHash({ page: 'board', boardId: board.id })}
                className="min-w-0 truncate text-sm font-medium text-stone-500 hover:text-stone-900"
                title={board.name}
              >
                {board.name}
              </a>
            ) : (
              <span className="min-w-0 truncate text-sm font-medium text-stone-900" title={board.name} aria-current="page">
                {board.name}
              </span>
            )}
          </>
        )}
        {decision && (
          <>
            <Separator />
            <span className="min-w-0 truncate text-sm font-medium text-stone-900" title={decision.name} aria-current="page">
              {decision.name}
            </span>
          </>
        )}
      </nav>
      {nav}
      {status}
    </header>
  )
}

function Separator() {
  return (
    <span aria-hidden="true" className="shrink-0 text-stone-300">
      /
    </span>
  )
}
