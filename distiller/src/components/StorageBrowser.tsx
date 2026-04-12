import { useEffect, useState } from 'react'
import type { EntityType, EntitySummary, EntityFile } from '../types/entities'

const TABS: EntityType[] = ['characters', 'locations', 'factions', 'events']
const LABELS: Record<EntityType, string> = {
  characters: 'Personaggi',
  locations: 'Luoghi',
  factions: 'Fazioni',
  events: 'Eventi'
}

export default function StorageBrowser() {
  const [tab, setTab] = useState<EntityType>('characters')
  const [entities, setEntities] = useState<EntitySummary[]>([])
  const [selected, setSelected] = useState<EntityFile | null>(null)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<EntitySummary[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadTab(tab)
  }, [tab])

  async function loadTab(type: EntityType) {
    setLoading(true)
    setSelected(null)
    setSelectedSlug(null)
    const list = await window.chronicler.listEntities(type)
    setEntities(list)
    setLoading(false)
  }

  async function handleSearch(q: string) {
    setQuery(q)
    if (!q.trim()) { setSearchResults(null); return }
    const results = await window.chronicler.searchEntities(q)
    setSearchResults(results)
  }

  async function openEntity(type: EntityType, slug: string) {
    const file = await window.chronicler.getEntity(type, slug)
    setSelected(file)
    setSelectedSlug(slug)
  }

  const displayList = searchResults ?? entities

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Sidebar */}
      <div style={{
        width: 280,
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Search */}
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
          <input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Cerca…"
            style={{ width: '100%' }}
          />
        </div>

        {/* Tabs */}
        {!searchResults && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1,
                  borderRadius: 0,
                  border: 'none',
                  borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                  background: 'transparent',
                  fontSize: 11,
                  padding: '6px 4px'
                }}
              >
                {LABELS[t]}
              </button>
            ))}
          </div>
        )}

        {/* List */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading && <div style={{ padding: 16, color: 'var(--text-muted)' }}>Caricamento…</div>}
          {!loading && displayList.map((e) => (
            <div
              key={`${e.type}::${e.slug}`}
              onClick={() => openEntity(e.type, e.slug)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                background: selectedSlug === e.slug ? 'var(--surface2)' : 'transparent',
                borderBottom: '1px solid var(--border)',
                fontSize: 13
              }}
            >
              <div>{e.name}</div>
              {searchResults && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.type}</div>
              )}
            </div>
          ))}
          {!loading && displayList.length === 0 && (
            <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>
              Nessuna entità trovata.
            </div>
          )}
        </div>
      </div>

      {/* Detail pane */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {selected ? (
          <div>
            <h2 style={{ marginBottom: 16 }}>{String(selected.frontmatter.name ?? selectedSlug)}</h2>
            <div style={{ marginBottom: 16 }}>
              {Object.entries(selected.frontmatter)
                .filter(([k]) => k !== 'name')
                .map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', gap: 12, marginBottom: 4, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)', minWidth: 120 }}>{k}:</span>
                    <span>{JSON.stringify(v)}</span>
                  </div>
                ))}
            </div>
            <pre style={{
              background: 'var(--surface)',
              padding: 16,
              borderRadius: 'var(--radius)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: 13,
              lineHeight: 1.6
            }}>
              {selected.body}
            </pre>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', marginTop: 40, textAlign: 'center' }}>
            Seleziona un'entità dall'archivio
          </div>
        )}
      </div>
    </div>
  )
}
