import { useState, useCallback } from 'react'
import type { EntityType, EntitySummary, EntityFile } from '../types/entities'

export function useStorage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function withLoading<T>(fn: () => Promise<T>): Promise<T | null> {
    setLoading(true)
    setError(null)
    try {
      return await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
      return null
    } finally {
      setLoading(false)
    }
  }

  const listEntities = useCallback(
    (entityType: EntityType): Promise<EntitySummary[] | null> =>
      withLoading(() => window.chronicler.listEntities(entityType)),
    []
  )

  const getEntity = useCallback(
    (entityType: EntityType, slug: string): Promise<EntityFile | null> =>
      withLoading(() => window.chronicler.getEntity(entityType, slug)),
    []
  )

  const createEntity = useCallback(
    (entityType: EntityType, content: EntityFile): Promise<void | null> =>
      withLoading(() => window.chronicler.createEntity(entityType, content)),
    []
  )

  const updateEntity = useCallback(
    (entityType: EntityType, slug: string, content: EntityFile): Promise<void | null> =>
      withLoading(() => window.chronicler.updateEntity(entityType, slug, content)),
    []
  )

  const searchEntities = useCallback(
    (query: string): Promise<EntitySummary[] | null> =>
      withLoading(() => window.chronicler.searchEntities(query)),
    []
  )

  return {
    loading,
    error,
    listEntities,
    getEntity,
    createEntity,
    updateEntity,
    searchEntities
  }
}
