import { useState } from 'react'
import type { ExtractedEntity, EntityType } from '../types/entities'

interface Props {
  entity: ExtractedEntity
  entityType: EntityType
  onCreated: () => void
  onCancel: () => void
}

const REQUIRED_FIELDS: Record<EntityType, string[]> = {
  characters: ['category', 'status', 'race', 'class'],
  locations: ['category', 'status'],
  factions: ['category', 'status'],
  events: ['category', 'location']
}

export default function EntityCreator({ entity, entityType, onCreated, onCancel }: Props) {
  const [fields, setFields] = useState<Record<string, string>>({
    ...Object.fromEntries(
      Object.entries(entity.extracted_data.frontmatter).map(([k, v]) => [k, String(v ?? '')])
    )
  })
  const [saving, setSaving] = useState(false)

  function setField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  async function handleCreate() {
    setSaving(true)
    try {
      const slug = await window.chronicler.generateSlug(entity.name, entityType)
      let timetrack: number | undefined
      if (entityType === 'events') {
        timetrack = await window.chronicler.getNextEventTimetrack()
      }
      const today = new Date().toISOString().split('T')[0]
      await window.chronicler.createEntity(entityType, {
        frontmatter: sanitizeFrontmatter({
          name: entity.name,
          slug,
          type: entityType.replace(/s$/, ''),
          ...fields,
          ...(timetrack !== undefined ? { timetrack } : {}),
          aliases: [],
          tags: [],
          last_updated: today
        }, entityType),
        body: buildBody(entity, entityType)
      })
      onCreated()
    } finally {
      setSaving(false)
    }
  }

  const required = REQUIRED_FIELDS[entityType] ?? []
  const missing = required.filter((f) => !fields[f])

  function buildBody(entity: ExtractedEntity, entityType: EntityType): string {
    const sections = entity.extracted_data.body_sections.filter(
      (section) => section.section_name.trim() && section.content.trim()
    )

    if (sections.length === 0) {
      const heading = entityType === 'events' ? 'Summary' : 'Description'
      const fallback = entity.reasoning?.trim() || 'Menzionato in sessione, ma senza dettagli strutturati aggiuntivi.'
      return `## ${heading}\n\n${fallback}`
    }

    return sections
      .map((section) => `## ${section.section_name}\n\n${section.content}`)
      .join('\n\n')
  }

  function sanitizeFrontmatter(
    frontmatter: Record<string, unknown>,
    entityType: EntityType
  ): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(frontmatter)) {
      if (value === null || value === undefined) continue
      sanitized[key] = value
    }

    if (entityType === 'characters') {
      sanitized.category ??= 'npc'
      sanitized.status ??= 'unknown'
      sanitized.race ??= ''
      sanitized.class ??= ''
    }

    sanitized.aliases = Array.isArray(sanitized.aliases) ? sanitized.aliases : []
    sanitized.tags = Array.isArray(sanitized.tags) ? sanitized.tags : []
    return sanitized
  }

  return (
    <div style={{
      marginTop: 12,
      padding: 16,
      background: 'var(--bg)',
      borderRadius: 'var(--radius)'
    }}>
      <h4 style={{ marginBottom: 12 }}>Crea: {entity.name}</h4>

      {required.map((field) => (
        <div key={field} style={{ marginBottom: 10 }}>
          <label style={{
            display: 'block',
            marginBottom: 4,
            fontSize: 12,
            color: !fields[field] ? '#f87171' : 'var(--text-muted)'
          }}>
            {field} {!fields[field] ? '(richiesto)' : ''}
          </label>
          <input
            value={fields[field] ?? ''}
            onChange={(e) => setField(field, e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          className="primary"
          onClick={handleCreate}
          disabled={saving || missing.length > 0}
        >
          {saving ? 'Salvataggio…' : 'Crea Entità'}
        </button>
        <button onClick={onCancel}>Annulla</button>
      </div>
    </div>
  )
}
