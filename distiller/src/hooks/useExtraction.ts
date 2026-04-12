import { useState } from 'react'
import type { EntityType, ExtractionResult, KnownEntity, Provider } from '../types/entities'

type ProgressState = 'idle' | 'loading' | 'done' | 'error'

type Progress = Record<EntityType, ProgressState>

const ENTITY_TYPES: EntityType[] = ['characters', 'locations', 'factions', 'events']

export function useExtraction() {
  const [isExtracting, setIsExtracting] = useState(false)
  const [progress, setProgress] = useState<Progress>({
    characters: 'idle',
    locations: 'idle',
    factions: 'idle',
    events: 'idle'
  })
  const [error, setError] = useState<string | null>(null)

  function setTypeProgress(type: EntityType, state: ProgressState) {
    setProgress((prev) => ({ ...prev, [type]: state }))
  }

  async function extractAll(
    recapText: string,
    provider: Provider,
    model: string
  ): Promise<ExtractionResult[] | null> {
    setIsExtracting(true)
    setError(null)
    setProgress({ characters: 'idle', locations: 'idle', factions: 'idle', events: 'idle' })

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

  return { extractAll, progress, isExtracting, error }
}
