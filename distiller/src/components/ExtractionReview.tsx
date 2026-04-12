import { useState } from 'react'
import type { ExtractionResult, ExtractedEntity, EntityType } from '../types/entities'
import EntityCard from './EntityCard'

interface Props {
  results: ExtractionResult[]
  onDone: () => void
}

type Decision = 'approve' | 'skip'
type DecisionMap = Record<string, Decision>

const LABELS: Record<EntityType, string> = {
  characters: 'Personaggi',
  locations: 'Luoghi',
  factions: 'Fazioni',
  events: 'Eventi'
}

export default function ExtractionReview({ results, onDone }: Props) {
  const [decisions, setDecisions] = useState<DecisionMap>({})
  const [saving, setSaving] = useState(false)

  function key(entityType: EntityType, name: string) {
    return `${entityType}::${name}`
  }

  function decide(entityType: EntityType, name: string, decision: Decision) {
    setDecisions((prev) => ({ ...prev, [key(entityType, name)]: decision }))
  }

  function approveAll() {
    const all: DecisionMap = {}
    for (const r of results) {
      for (const e of r.entities) {
        all[key(r.entity_type, e.name)] = 'approve'
      }
    }
    setDecisions(all)
  }

  async function saveApproved() {
    setSaving(true)
    try {
      for (const result of results) {
        for (const entity of result.entities) {
          const k = key(result.entity_type, entity.name)
          if (decisions[k] !== 'approve') continue
          await saveEntity(result.entity_type, entity)
        }
      }
      onDone()
    } finally {
      setSaving(false)
    }
  }

  async function saveEntity(entityType: EntityType, entity: ExtractedEntity) {
    if (entity.matched_slug) {
      // UPDATE existing
      const existing = await window.chronicler.getEntity(entityType, entity.matched_slug)
      const updated = applyExtractedData(existing, entity)
      await window.chronicler.updateEntity(entityType, entity.matched_slug, updated)
    } else {
      // CREATE new
      const slug = await window.chronicler.generateSlug(entity.name, entityType)
      let timetrack: number | undefined
      if (entityType === 'events') {
        timetrack = await window.chronicler.getNextEventTimetrack()
      }
      const today = new Date().toISOString().split('T')[0]
      await window.chronicler.createEntity(entityType, {
        frontmatter: {
          name: entity.name,
          slug,
          type: entityType.replace(/s$/, '') as string,
          ...entity.extracted_data.frontmatter,
          ...(timetrack !== undefined ? { timetrack } : {}),
          last_updated: today
        },
        body: buildBody(entity)
      })
    }
  }

  function applyExtractedData(
    existing: { frontmatter: Record<string, unknown>; body: string },
    entity: ExtractedEntity
  ) {
    const updatable = ['status', 'tags', 'aliases', 'last_updated']
    const newFm = { ...existing.frontmatter }
    for (const [k, v] of Object.entries(entity.extracted_data.frontmatter)) {
      if (updatable.includes(k)) {
        if (k === 'tags' || k === 'aliases') {
          newFm[k] = [...new Set([...(newFm[k] as string[] ?? []), ...(v as string[] ?? [])])]
        } else {
          newFm[k] = v
        }
      }
    }
    newFm.last_updated = new Date().toISOString().split('T')[0]
    let body = existing.body
    for (const section of entity.extracted_data.body_sections) {
      if (section.mode === 'append') {
        body = appendSection(body, section.section_name, section.content)
      } else {
        body = replaceSection(body, section.section_name, section.content)
      }
    }
    return { frontmatter: newFm, body }
  }

  function appendSection(body: string, name: string, content: string): string {
    const heading = `## ${name}`
    if (body.includes(heading)) {
      return body.replace(
        new RegExp(`(## ${name}[\\s\\S]*?)(?=\\n## |$)`),
        (match) => `${match.trimEnd()}\n${content}\n`
      )
    }
    return `${body.trimEnd()}\n\n## ${name}\n\n${content}\n`
  }

  function replaceSection(body: string, name: string, content: string): string {
    const heading = `## ${name}`
    if (body.includes(heading)) {
      return body.replace(
        new RegExp(`## ${name}[\\s\\S]*?(?=\\n## |$)`),
        `## ${name}\n\n${content}\n`
      )
    }
    return `${body.trimEnd()}\n\n## ${name}\n\n${content}\n`
  }

  function buildBody(entity: ExtractedEntity): string {
    const parts: string[] = []
    for (const section of entity.extracted_data.body_sections) {
      parts.push(`## ${section.section_name}\n\n${section.content}`)
    }
    return parts.join('\n\n')
  }

  const totalEntities = results.reduce((n, r) => n + r.entities.length, 0)
  const approvedCount = Object.values(decisions).filter((d) => d === 'approve').length

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2>Revisione Estrazione</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={approveAll}>Approva tutto</button>
          <button
            className="primary"
            onClick={saveApproved}
            disabled={saving || approvedCount === 0}
          >
            {saving ? 'Salvataggio…' : `Salva Approvati (${approvedCount}/${totalEntities})`}
          </button>
        </div>
      </div>

      {results.map((result) => (
        <section key={result.entity_type} style={{ marginBottom: 32 }}>
          <h3 style={{ marginBottom: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: 12, letterSpacing: 1 }}>
            {LABELS[result.entity_type]} ({result.entities.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {result.entities.map((entity) => (
              <EntityCard
                key={entity.name}
                entity={entity}
                entityType={result.entity_type}
                decision={decisions[key(result.entity_type, entity.name)]}
                onDecide={(d) => decide(result.entity_type, entity.name, d)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
