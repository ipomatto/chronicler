import { useEffect, useState } from 'react'
import type { ExtractedEntity, EntityType, MatchCandidate } from '../types/entities'

interface Props {
  entity: ExtractedEntity
  entityType: EntityType
  onResolved: (slug: string | null) => void
}

export default function MatchResolver({ entity, entityType, onResolved }: Props) {
  const [candidates, setCandidates] = useState<MatchCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | 'new' | null>(null)

  useEffect(() => {
    window.chronicler.findSimilarEntities(entity.name, entityType)
      .then(setCandidates)
      .finally(() => setLoading(false))
  }, [entity.name, entityType])

  function confirm() {
    if (selected === 'new') onResolved(null)
    else if (selected) onResolved(selected)
  }

  return (
    <div style={{
      marginTop: 12,
      padding: 16,
      background: 'var(--bg)',
      borderRadius: 'var(--radius)'
    }}>
      <p style={{ marginBottom: 12, color: 'var(--text-muted)', fontSize: 12 }}>
        Seleziona corrispondenza per <strong style={{ color: 'var(--text)' }}>{entity.name}</strong>:
      </p>

      {loading && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Ricerca…</div>}

      {!loading && candidates.map((c) => (
        <div
          key={c.slug}
          onClick={() => setSelected(c.slug)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 12px',
            marginBottom: 6,
            background: selected === c.slug ? 'var(--surface2)' : 'var(--surface)',
            border: `1px solid ${selected === c.slug ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 'var(--radius)',
            cursor: 'pointer'
          }}
        >
          <div>
            <strong>{c.name}</strong>
            <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontSize: 12 }}>{c.slug}</span>
            {c.aliases.length > 0 && (
              <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontSize: 12 }}>
                aka: {c.aliases.join(', ')}
              </span>
            )}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {Math.round(c.score * 100)}% · {c.reason}
          </span>
        </div>
      ))}

      <div
        onClick={() => setSelected('new')}
        style={{
          padding: '8px 12px',
          marginBottom: 12,
          background: selected === 'new' ? 'var(--surface2)' : 'var(--surface)',
          border: `1px solid ${selected === 'new' ? '#22c55e' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
          cursor: 'pointer',
          color: '#22c55e'
        }}
      >
        + Crea come nuova entità
      </div>

      <button className="primary" onClick={confirm} disabled={!selected}>
        Conferma
      </button>
    </div>
  )
}
