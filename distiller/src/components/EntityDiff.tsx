import { useEffect, useState } from 'react'
import type { ExtractedEntity, EntityType, EntityFile } from '../types/entities'

interface Props {
  entity: ExtractedEntity
  entityType: EntityType
}

export default function EntityDiff({ entity, entityType }: Props) {
  const [existing, setExisting] = useState<EntityFile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!entity.matched_slug) return
    window.chronicler.getEntity(entityType, entity.matched_slug)
      .then(setExisting)
      .finally(() => setLoading(false))
  }, [entity.matched_slug, entityType])

  if (loading) {
    return <div style={{ padding: '8px 0', color: 'var(--text-muted)', fontSize: 12 }}>Caricamento…</div>
  }
  if (!existing) return null

  const updatableFm = ['status', 'tags', 'aliases']
  const fmChanges = Object.entries(entity.extracted_data.frontmatter).filter(([k]) =>
    updatableFm.includes(k)
  )

  return (
    <div style={{
      marginTop: 12,
      padding: 12,
      background: 'var(--bg)',
      borderRadius: 'var(--radius)',
      fontSize: 12
    }}>
      {/* Frontmatter diff */}
      {fmChanges.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>
            Frontmatter
          </div>
          {fmChanges.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-muted)', minWidth: 100 }}>{k}:</span>
              <span style={{ color: '#f87171', textDecoration: 'line-through' }}>
                {JSON.stringify(existing.frontmatter[k])}
              </span>
              <span style={{ color: '#4ade80' }}>→ {JSON.stringify(v)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Body sections diff */}
      {entity.extracted_data.body_sections.length > 0 && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>
            Sezioni
          </div>
          {entity.extracted_data.body_sections.map((s, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>
                ## {s.section_name}
                <span style={{
                  marginLeft: 8,
                  fontSize: 10,
                  padding: '1px 4px',
                  borderRadius: 3,
                  background: s.mode === 'append' ? '#3b82f6' : '#f59e0b',
                  color: '#fff'
                }}>
                  {s.mode}
                </span>
              </div>
              <pre style={{
                background: '#1e293b',
                padding: 8,
                borderRadius: 4,
                color: '#4ade80',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {s.content}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
