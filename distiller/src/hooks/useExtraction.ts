import { useState } from 'react'
import type { EntityType, ExtractionResult, KnownEntity, Provider } from '../types/entities'

type ProgressState = 'idle' | 'loading' | 'done' | 'error'

type Progress = Record<EntityType, ProgressState>

const ENTITY_TYPES: EntityType[] = ['characters', 'locations', 'factions', 'events']

const NULL_TIMES: Record<EntityType, number | null> = {
  characters: null, locations: null, factions: null, events: null
}
const ZERO_COUNTS: Record<EntityType, number> = {
  characters: 0, locations: 0, factions: 0, events: 0
}

export function useExtraction() {
  const [isExtracting, setIsExtracting] = useState(false)
  const [progress, setProgress] = useState<Progress>({
    characters: 'idle',
    locations: 'idle',
    factions: 'idle',
    events: 'idle'
  })
  const [startTimes, setStartTimes] = useState<Record<EntityType, number | null>>(NULL_TIMES)
  const [counts, setCounts] = useState<Record<EntityType, number>>(ZERO_COUNTS)
  const [error, setError] = useState<string | null>(null)

  function setTypeProgress(type: EntityType, state: ProgressState) {
    setProgress((prev) => ({ ...prev, [type]: state }))
    if (state === 'loading') {
      setStartTimes((prev) => ({ ...prev, [type]: Date.now() }))
    }
  }

  async function extractAll(
    recapText: string,
    provider: Provider,
    model: string
  ): Promise<ExtractionResult[] | null> {
    setIsExtracting(true)
    setError(null)
    setProgress({ characters: 'idle', locations: 'idle', factions: 'idle', events: 'idle' })
    setStartTimes({ ...NULL_TIMES })
    setCounts({ ...ZERO_COUNTS })

    try {
      // Run all 4 extraction calls in parallel
      const promises = ENTITY_TYPES.map(async (entityType) => {
        setTypeProgress(entityType, 'loading')
        try {
          // Load known entities for context
          const knownSummaries = await window.chronicler.listEntities(entityType)
          const knownEntities: KnownEntity[] = knownSummaries.map((s) => ({
            slug: s.slug,
            name: s.name,
            aliases: (s.frontmatter.aliases as string[] | undefined) ?? []
          }))

          const result = await window.chronicler.extractEntities(
            provider,
            model,
            entityType,
            recapText,
            knownEntities
          )
          setCounts((prev) => ({ ...prev, [entityType]: result.entities.length }))
          setTypeProgress(entityType, 'done')
          return result
        } catch (err) {
          setTypeProgress(entityType, 'error')
          throw err
        }
      })

      const results = await Promise.all(promises)
      return results
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto durante l\'estrazione')
      return null
    } finally {
      setIsExtracting(false)
    }
  }

  return { extractAll, progress, startTimes, counts, isExtracting, error }
}
