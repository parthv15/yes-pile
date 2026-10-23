import { useEffect, useState } from 'react'

export type Tab = 'add' | 'review' | 'pile' | 'maybe' | 'passed' | 'yes'
const TABS: Tab[] = ['add', 'review', 'pile', 'maybe', 'passed', 'yes']

/** Where you are: all boards, one board, or a decision inside it (optionally on a tab). */
export type Route =
  | { page: 'boards' }
  | { page: 'board'; boardId: number }
  | { page: 'decision'; boardId: number; decisionId: number; tab?: Tab }

const LAST_ROUTE = 'yes-pile:last-route'

export function routeToHash(route: Route) {
  if (route.page === 'boards') return '#/'
  if (route.page === 'board') return `#/b/${route.boardId}`
  return `#/b/${route.boardId}/d/${route.decisionId}${route.tab ? `/${route.tab}` : ''}`
}

export function parseHash(hash: string): Route | null {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts.length === 0) return { page: 'boards' }
  const boardId = Number(parts[1])
  if (parts[0] !== 'b' || !Number.isInteger(boardId)) return null
  if (parts.length === 2) return { page: 'board', boardId }
  const decisionId = Number(parts[3])
  if (parts[2] !== 'd' || !Number.isInteger(decisionId)) return null
  const tab = parts[4] as Tab | undefined
  if (tab && !TABS.includes(tab)) return { page: 'decision', boardId, decisionId }
  return { page: 'decision', boardId, decisionId, tab }
}

/** Go somewhere. The browser's back and forward buttons work as you'd expect. */
export function navigate(route: Route, { replace = false } = {}) {
  const hash = routeToHash(route)
  if (location.hash === hash) return
  if (replace) history.replaceState(null, '', hash)
  else location.hash = hash
  // replaceState doesn't fire hashchange, so tell listeners ourselves.
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'))
}

function readLastRoute() {
  try {
    return localStorage.getItem(LAST_ROUTE)
  } catch {
    return null
  }
}

function initialRoute(): Route {
  // Opening the app without a link picks up where you left off.
  const hash = location.hash || readLastRoute() || ''
  return parseHash(hash) ?? { page: 'boards' }
}

/** The current route, kept in the URL hash so it can be bookmarked and survives reloads. */
export function useRoute(): Route {
  const [route, setRoute] = useState(initialRoute)

  useEffect(() => {
    if (!location.hash) history.replaceState(null, '', routeToHash(route))
    const onChange = () => setRoute(parseHash(location.hash) ?? { page: 'boards' })
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
    // Only on mount: later changes come through hashchange.
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(LAST_ROUTE, routeToHash(route))
    } catch {
      // Private windows can refuse storage; you just start at your boards next time.
    }
  }, [route])

  return route
}
