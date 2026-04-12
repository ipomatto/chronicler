import { useState } from 'react'
import type { EntityFile, EntityType } from '../types/entities'
import { parseSections, buildBody } from '../lib/markdown'

// ---------------------------------------------------------------------------
// Field configuration per entity type
// ---------------------------------------------------------------------------

const SELECT_FIELDS: Record<EntityType, Record<string, string[]>> = {
  characters: {
    category: ['pc', 'npc'],
    status:   ['alive', 'dead', 'missing', 'unknown'],
  },
  locations: {
    category: ['city', 'town', 'village', 'dungeon', 'region', 'wilderness', 'landmark', 'building'],
    status:   ['active', 'destroyed', 'abandoned', 'contested', 'unknown'],
  },
  factions: {
    category: ['political', 'military', 'religious', 'criminal', 'mercantile', 'arcane', 'other'],
    status:   ['active', 'disbanded', 'secret', 'destroyed', 'unknown'],
  },
  events: {
    category: ['combat', 'social', 'exploration', 'discovery', 'political', 'catastrophe', 'ritual', 'other'],
  },
}

const TEXT_FIELDS: Record<EntityType, string[]> = {
  characters: ['race', 'class'],
  locations:  ['parent_location'],
  factions:   ['base_of_operations'],
  events:     ['date_in_world', 'location'],
}

// Fields that are shown but not editable
const READONLY_FIELDS: Record<EntityType, string[]> = {
  characters: ['slug', 'type', 'last_updated', 'sessione'],
  locations:  ['slug', 'type', 'last_updated', 'sessione'],
  factions:   ['slug', 'type', 'last_updated', 'sessione'],
  events:     ['slug', 'type', 'timetrack', 'last_updated', 'sessione'],
}

// ---------------------------------------------------------------------------
// TagWidget — defined at module level to avoid re-creation on each render
// ---------------------------------------------------------------------------

interface TagWidgetProps {
  values: string[]
  onRemove: (v: string) => void
  inputValue: string
  onInputChange: (v: string) => void
  onAdd: () => void
}

function TagWidget({ values, onRemove, inputValue, onInputChange, onAdd }: TagWidgetProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
      {values.map((v) => (
        <span
          key={v}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '2px 8px',
            fontSize: 12,
          }}
        >
          {v}
          <button
            onClick={() => onRemove(v)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '0 2px',
              fontSize: 13,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={inputValue}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); onAdd() }
        }}
        placeholder="aggiungi…"
        style={{ width: 110, fontSize: 12, padding: '2px 6px' }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// EntityEditor
// ---------------------------------------------------------------------------

interface Props {
  file: EntityFile
  entityType: EntityType
  slug: string
  onSaved: (updated: EntityFile) => void
  onCancel: () => void
}

export default function EntityEditor({ file, entityType, slug, onSaved, onCancel }: Props) {
  const selectDefs   = SELECT_FIELDS[entityType]
  const textFields   = TEXT_FIELDS[entityType]
  const readonlyFields = READONLY_FIELDS[entityType]

  // Select state — if stored value not in valid options, fall back to ''
  const [selects, setSelects] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const [field, options] of Object.entries(selectDefs)) {
      const stored = String(file.frontmatter[field] ?? '')
      init[field] = options.includes(stored) ? stored : ''
    }
    return init
  })

  // Text input state — '' when null/missing
  const [texts, setTexts] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const field of textFields) {
      init[field] = String(file.frontmatter[field] ?? '')
    }
    return init
  })

  const [tags, setTags] = useState<string[]>(() =>
    Array.isArray(file.frontmatter.tags) ? (file.frontmatter.tags as string[]) : []
  )
  const [aliases, setAliases] = useState<string[]>(() =>
    Array.isArray(file.frontmatter.aliases) ? (file.frontmatter.aliases as string[]) : []
  )

  const [sections, setSections] = useState<Map<string, string>>(() => parseSections(file.body))

  const [tagInput,   setTagInput]   = useState('')
  const [aliasInput, setAliasInput] = useState('')
  const [saving, setSaving] = useState(false)

  // ── handlers ──────────────────────────────────────────────────────────────

  function updateSection(heading: string, content: string) {
    setSections((prev) => new Map(prev).set(heading, content))
  }

  function addTag() {
    const v = tagInput.trim()
    if (v && !tags.includes(v)) setTags((prev) => [...prev, v])
    setTagInput('')
  }

  function addAlias() {
    const v = aliasInput.trim()
    if (v && !aliases.includes(v)) setAliases((prev) => [...prev, v])
    setAliasInput('')
  }

  async function handleSave() {
    setSaving(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const updatedFrontmatter: Record<string, unknown> = {
        ...file.frontmatter,
        ...selects,
        ...texts,
        tags,
        ...(entityType === 'characters' ? { aliases } : {}),
        last_updated: today,
      }
      const updated: EntityFile = {
        frontmatter: updatedFrontmatter,
        body: buildBody(sections),
      }
      await window.chronicler.updateEntity(entityType, slug, updated)
      onSaved(updated)
    } finally {
      setSaving(false)
    }
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  const visibleReadonly = readonlyFields.filter((f) => file.frontmatter[f] != null)

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* ── Section 1: Proprietà ───────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{
          marginBottom: 16,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: 1,
          color: 'var(--text-muted)',
          fontWeight: 600,
        }}>
          Proprietà
        </h3>

        {/* Readonly fields */}
        {visibleReadonly.map((f) => (
          <div key={f} style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'baseline' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 12, minWidth: 160, flexShrink: 0 }}>{f}</span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {String(file.frontmatter[f])}
            </span>
          </div>
        ))}

        {visibleReadonly.length > 0 && (
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '14px 0' }} />
        )}

        {/* Select fields */}
        {Object.entries(selectDefs).map(([field, options]) => (
          <div key={field} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: 12, minWidth: 160, flexShrink: 0 }}>
              {field}
            </label>
            <select
              value={selects[field]}
              onChange={(e) => setSelects((prev) => ({ ...prev, [field]: e.target.value }))}
              style={{ minWidth: 200 }}
            >
              {selects[field] === '' && (
                <option value="">— seleziona —</option>
              )}
              {options.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        ))}

        {/* Text input fields */}
        {textFields.map((field) => (
          <div key={field} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: 12, minWidth: 160, flexShrink: 0 }}>
              {field}
            </label>
            <input
              value={texts[field]}
              onChange={(e) => setTexts((prev) => ({ ...prev, [field]: e.target.value }))}
              placeholder="(vuoto)"
              style={{ flex: 1, maxWidth: 380 }}
            />
          </div>
        ))}

        {/* Tags */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 12, minWidth: 160, flexShrink: 0, paddingTop: 4 }}>
            tags
          </span>
          <TagWidget
            values={tags}
            onRemove={(v) => setTags((prev) => prev.filter((t) => t !== v))}
            inputValue={tagInput}
            onInputChange={setTagInput}
            onAdd={addTag}
          />
        </div>

        {/* Aliases (characters only) */}
        {entityType === 'characters' && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 12, minWidth: 160, flexShrink: 0, paddingTop: 4 }}>
              aliases
            </span>
            <TagWidget
              values={aliases}
              onRemove={(v) => setAliases((prev) => prev.filter((a) => a !== v))}
              inputValue={aliasInput}
              onInputChange={setAliasInput}
              onAdd={addAlias}
            />
          </div>
        )}
      </div>

      {/* ── Section 2: Descrizione ─────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <h3 style={{
          marginBottom: 16,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: 1,
          color: 'var(--text-muted)',
          fontWeight: 600,
        }}>
          Descrizione
        </h3>

        {sections.size === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nessuna sezione presente.</div>
        ) : (
          Array.from(sections.entries()).map(([heading, content]) => (
            <div key={heading} style={{ marginBottom: 20 }}>
              <div style={{
                fontSize: 12,
                fontFamily: 'monospace',
                color: 'var(--text-muted)',
                marginBottom: 6,
                userSelect: 'none',
              }}>
                ## {heading}
              </div>
              <textarea
                value={content}
                onChange={(e) => updateSection(heading, e.target.value)}
                style={{
                  width: '100%',
                  minHeight: 100,
                  resize: 'vertical',
                  fontSize: 13,
                  lineHeight: 1.6,
                  fontFamily: 'inherit',
                }}
              />
            </div>
          ))
        )}
      </div>

      {/* ── Save / Cancel ──────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        gap: 8,
        paddingTop: 16,
        borderTop: '1px solid var(--border)',
      }}>
        <button className="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Salvataggio…' : 'Salva'}
        </button>
        <button onClick={onCancel} disabled={saving}>
          Annulla
        </button>
      </div>

    </div>
  )
}
