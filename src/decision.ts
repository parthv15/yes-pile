import { createContext, useContext } from 'react'
import type { Board, Decision } from './db'

/** The board and decision being worked on, for views and components that save changes. */
export const DecisionContext = createContext<{ board: Board; decision: Decision } | null>(null)

export function useDecision() {
  const value = useContext(DecisionContext)
  if (!value) throw new Error('useDecision needs a DecisionContext provider')
  return value
}
