import { useState } from 'react'
import type { ExtractedEntity, EntityType } from '../types/entities'
import EntityDiff from './EntityDiff'
import MatchResolver from './MatchResolver'

interface Props {
  entity: ExtractedEntity
  entityType: EntityType
  decision: 'approve' | 'skip' | undefined
  onDecide: (d: 'approve' | 'skip') => void
  onResolved?: (slug: string | null) => void
}

export default function EntityCard({ entity, entityType, decision, onDecide, onResolved }: Props) {
  const [showDiff, setShowDiff] = useState(false)
  const [resolving, setResolving] = useState(false)
  // undefined = not yet disambiguated; null = user chose "create new"; string = matched slug
  const [localMatchedSlug, setLocalMatchedSlug] = useState<string | null | undefined>(undefined)

  const effectiveMatchedSlug = localMatchedSlug !== undefined ? localMatchedSlug : entity.matched_slug
  const isUpdate = !!effectiveMatchedSlug
  const possibleMatches = Array.isArray(entity.possible_matches) ? entity.possible_matches : []
  const isAmbiguous = localMatchedSlug === undefined && !entity.matched_slug && possibleMatches.length > 0

  const badge = isAmbiguous ? 'AMBIGUOUS' : isUpdate ? 'UPDATE' : 'NEW'
  const badgeColor = isAmbiguous ? '#f59e0b' : isUpdate ? '#3b82f6' : '#22c55e'

  const borderColor =
    decision === 'approve' ? '#22c55e' :
    decision === 'skip' ? 'var(--border)' :
    'var(--border)'

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius)',
      padding: '12px 16px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: 4,
            background: badgeColor,
            color: '#fff',
            letterSpacing: 0.5
          }}>
            {badge}
          </span>
          <strong>{entity.name}</strong>
          {effectiveMatchedSlug && (
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>→ {effectiveMatchedSlug}</span>
          )}
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            ({Math.round((entity.confidence ?? 0) * 100)}% confidence)
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {isAmbiguous && (
            <button onClick={() => setResolving(true)}>Disambigua</button>
          )}
          {isUpdate && (
            <button onClick={() => setShowDiff(!showDiff)}>
              {showDiff ? 'Nascondi diff' : 'Vedi diff'}
            </button>
          )}

          <button
            onClick={() => onDecide('approve')}
            style={{ background: decision === 'approve' ? '#22c55e' : undefined }}
          >
            Approva
          </button>
          <button
            onClick={() => onDecide('skip')}
            style={{ background: decision === 'skip' ? '#6b7280' : undefined }}
          >
            Salta
          </button>
        </div>
      </div>

      {entity.reasoning && (
        <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          {entity.reasoning}
        </p>
      )}

      {showDiff && effectiveMatchedSlug && (
        <EntityDiff entity={entity} entityType={entityType} slug={effectiveMatchedSlug} />
      )}

      {resolving && (
        <MatchResolver
          entity={entity}
          entityType={entityType}
          onResolved={(slug) => {
            setLocalMatchedSlug(slug)
            setResolving(false)
            onResolved?.(slug)
          }}
        />
      )}
    </div>
  )
}
