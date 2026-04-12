import { useState, useCallback } from 'react'
import type { EntityType, MatchCandidate } from '../types/entities'

export function useMatching() {
  const [loading, setLoading] = useState(false)
  const [candidates, setCandidates] = useState<MatchCandidate[]>([])

  const findSimilar = useCallback(async (name: string, entityType: EntityType) => {
    setLoading(true)
    setCandidates([])
    try {
      const results = await window.chronicler.findSimilarEntities(name, entityType)
      setCandidates(results)
      return results
    } finally {
      setLoading(false)
    }
  }, [])

  function reset() {
    setCandidates([])
  }

  return { loading, candidates, findSimilar, reset }
}
