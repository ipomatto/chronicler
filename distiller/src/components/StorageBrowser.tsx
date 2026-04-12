import { useEffect, useState } from 'react'
import type { EntityType, EntitySummary, EntityFile, UnlinkedMatch } from '../types/entities'

const TABS: EntityType[] = ['characters', 'locations', 'factions', 'events']
const LABELS: Record<EntityType, string> = {
  characters: 'Personaggi',
  locations: 'Luoghi',
  factions: 'Fazioni',
  events: 'Eventi'
}

// Replace all unlinked occurrences of entityName in body (preserves existing [[links]])
function linkEntityInText(body: string, entityName: string): string {
  const parts = body.split(/(\[\[[^\]]*\]\])/g)
  const escaped = entityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(escaped, 'gi')
  return parts
    .map((part, i) => (i % 2 === 0 ? part.replace(regex, `[[${entityName}]]`) : part))
    .join('')
}

export default function StorageBrowser() {
  const [tab, setTab] = useState<EntityType>('characters')
  const [entities, setEntities] = useState<EntitySummary[]>([])
  const [selected, setSelected] = useState<EntityFile | null>(null)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<EntityType | null>(null)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<EntitySummary[] | null>(null)
  const [loading, setLoading] = useState(false)

  // "Collega" (single selection) state
  const [selectedText, setSelectedText] = useState('')
  const [linkCandidates, setLinkCandidates] = useState<EntitySummary[] | null>(null)
  const [linkLoading, setLinkLoading] = useState(false)
  const [linkSaving, setLinkSaving] = useState(false)

  // "Collega tutti" state
  const [autoMatches, setAutoMatches] = useState<UnlinkedMatch[] | null>(null)
  const [autoLoading, setAutoLoading] = useState(false)
  const [autoSelected, setAutoSelected] = useState<Set<string>>(new Set())
  const [autoSaving, setAutoSaving] = useState(false)

  useEffect(() => { loadTab(tab) }, [tab])

  async function loadTab(type: EntityType) {
    setLoading(true)
    setSelected(null)
    setSelectedSlug(null)
    setSelectedType(null)
    clearAllLinkState()
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
    setSelectedType(type)
    clearAllLinkState()
  }

  function clearAllLinkState() {
    setSelectedText('')
    setLinkCandidates(null)
    setLinkLoading(false)
    setAutoMatches(null)
    setAutoSelected(new Set())
    setAutoLoading(false)
  }

  // --------------------------------------------------------------------------
  // Collega (single)
  // --------------------------------------------------------------------------

  function handleBodyMouseUp() {
    const sel = window.getSelection()?.toString().trim() ?? ''
    setSelectedText(sel)
    if (!sel) setLinkCandidates(null)
  }

  async function handleLinkSearch() {
    if (!selectedText) return
    setLinkLoading(true)
    setLinkCandidates(null)
    setAutoMatches(null)
    const results = await window.chronicler.searchEntities(selectedText)
    setLinkCandidates(results)
    setLinkLoading(false)
  }

  async function handleLinkConfirm(candidate: EntitySummary) {
    if (!selected || !selectedSlug || !selectedType || !selectedText) return
    setLinkSaving(true)
    const newBody = selected.body.replace(selectedText, `[[${candidate.name}]]`)
    const updated: EntityFile = { ...selected, body: newBody }
    await window.chronicler.updateEntity(selectedType, selectedSlug, updated)
    setSelected(updated)
    clearAllLinkState()
    setLinkSaving(false)
  }

  // --------------------------------------------------------------------------
  // Collega tutti
  // --------------------------------------------------------------------------

  async function handleAutoLink() {
    if (!selected) return
    setAutoLoading(true)
    setLinkCandidates(null)
    setSelectedText('')
    const matches = await window.chronicler.findUnlinkedOccurrences(selected.body)
    setAutoMatches(matches)
    // Pre-select all by default
    setAutoSelected(new Set(matches.map((m) => m.entitySlug)))
    setAutoLoading(false)
  }

  function toggleAutoMatch(slug: string) {
    setAutoSelected((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  async function handleApplyAutoLinks() {
    if (!selected || !selectedSlug || !selectedType || !autoMatches) return
    setAutoSaving(true)
    let body = selected.body
    for (const match of autoMatches) {
      if (!autoSelected.has(match.entitySlug)) continue
      body = linkEntityInText(body, match.entityName)
    }
    const updated: EntityFile = { ...selected, body }
    await window.chronicler.updateEntity(selectedType, selectedSlug, updated)
    setSelected(updated)
    clearAllLinkState()
    setAutoSaving(false)
  }

  const displayList = searchResults ?? entities
  const hasAutoSelection = autoSelected.size > 0

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Sidebar */}
      <div style={{
        width: 280,
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0
      }}>
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
          <input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Cerca…"
            style={{ width: '100%' }}
          />
        </div>

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
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{LABELS[e.type]}</div>
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
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {selected ? (
          <>
            {/* Entity header */}
            <div style={{ padding: '16px 24px 0' }}>
              <h2 style={{ margin: '0 0 12px' }}>
                {String(selected.frontmatter.name ?? selectedSlug)}
              </h2>
            </div>

            {/* ── Toolbar ─────────────────────────────────────────────────── */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 24px',
              borderTop: '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface)',
              flexWrap: 'wrap'
            }}>
              {/* Collega (selection-based) */}
              <button
                onClick={handleLinkSearch}
                disabled={!selectedText || linkLoading || linkSaving || autoLoading}
                title={selectedText ? `Cerca entità per "${selectedText}"` : 'Seleziona del testo nel corpo per abilitare'}
                style={{
                  fontSize: 12,
                  padding: '4px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  cursor: selectedText ? 'pointer' : 'default',
                  background: selectedText ? 'var(--accent)' : 'transparent',
                  color: selectedText ? '#fff' : 'var(--text-muted)',
                  transition: 'background 0.15s, color 0.15s'
                }}
              >
                {linkLoading
                  ? 'Ricerca…'
                  : selectedText
                    ? `Collega "${selectedText.length > 25 ? selectedText.slice(0, 25) + '…' : selectedText}"`
                    : 'Collega'}
              </button>

              {/* Separator */}
              <span style={{ color: 'var(--border)', userSelect: 'none' }}>|</span>

              {/* Collega tutti */}
              <button
                onClick={handleAutoLink}
                disabled={autoLoading || autoSaving || linkLoading}
                style={{
                  fontSize: 12,
                  padding: '4px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  background: 'transparent'
                }}
              >
                {autoLoading ? 'Analisi…' : 'Collega tutti'}
              </button>

              {/* Cancel (when a panel is open) */}
              {(linkCandidates !== null || autoMatches !== null) && (
                <button
                  onClick={clearAllLinkState}
                  style={{
                    fontSize: 12,
                    padding: '4px 8px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    background: 'transparent',
                    marginLeft: 'auto'
                  }}
                >
                  Annulla
                </button>
              )}
            </div>
            {/* ── / Toolbar ────────────────────────────────────────────────── */}

            <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>

              {/* "Collega" candidates panel */}
              {linkCandidates !== null && (
                <div style={{
                  marginBottom: 20,
                  border: '1px solid var(--accent)',
                  borderRadius: 'var(--radius)',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    padding: '8px 12px',
                    background: 'var(--surface)',
                    borderBottom: '1px solid var(--border)',
                    fontSize: 12,
                    fontWeight: 600
                  }}>
                    Collega "{selectedText}" a:
                  </div>
                  {linkCandidates.length === 0 ? (
                    <div style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)' }}>
                      Nessuna entità trovata.
                    </div>
                  ) : (
                    linkCandidates.map((c) => (
                      <div
                        key={`${c.type}::${c.slug}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderBottom: '1px solid var(--border)',
                          fontSize: 13
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 500 }}>{c.name}</span>
                          <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                            {LABELS[c.type]}
                          </span>
                        </div>
                        <button
                          onClick={() => handleLinkConfirm(c)}
                          disabled={linkSaving}
                          style={{
                            fontSize: 12,
                            padding: '3px 10px',
                            background: 'var(--accent)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 'var(--radius)',
                            cursor: 'pointer'
                          }}
                        >
                          {linkSaving ? '…' : 'Collega'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* "Collega tutti" summary panel */}
              {autoMatches !== null && (
                <div style={{
                  marginBottom: 20,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    padding: '10px 14px',
                    background: 'var(--surface)',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {autoMatches.length === 0
                        ? 'Nessun riferimento non collegato trovato.'
                        : `${autoMatches.length} riferiment${autoMatches.length === 1 ? 'o' : 'i'} non collegatoa trovati — seleziona quelli da collegare:`}
                    </span>
                    {autoMatches.length > 0 && (
                      <button
                        onClick={handleApplyAutoLinks}
                        disabled={!hasAutoSelection || autoSaving}
                        style={{
                          fontSize: 12,
                          padding: '4px 14px',
                          background: hasAutoSelection ? 'var(--accent)' : 'var(--surface2)',
                          color: hasAutoSelection ? '#fff' : 'var(--text-muted)',
                          border: 'none',
                          borderRadius: 'var(--radius)',
                          cursor: hasAutoSelection ? 'pointer' : 'default',
                          flexShrink: 0
                        }}
                      >
                        {autoSaving ? 'Salvataggio…' : `Applica ${autoSelected.size} selezionat${autoSelected.size === 1 ? 'o' : 'i'}`}
                      </button>
                    )}
                  </div>

                  {autoMatches.length > 0 && (
                    <>
                      {/* Select all / none */}
                      <div style={{
                        padding: '6px 14px',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        gap: 12,
                        fontSize: 11
                      }}>
                        <button
                          onClick={() => setAutoSelected(new Set(autoMatches.map((m) => m.entitySlug)))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 11, padding: 0 }}
                        >
                          Seleziona tutti
                        </button>
                        <button
                          onClick={() => setAutoSelected(new Set())}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, padding: 0 }}
                        >
                          Deseleziona tutti
                        </button>
                      </div>

                      {autoMatches.map((m) => (
                        <label
                          key={m.entitySlug}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 14px',
                            borderBottom: '1px solid var(--border)',
                            fontSize: 13,
                            cursor: 'pointer',
                            background: autoSelected.has(m.entitySlug) ? 'var(--surface)' : 'transparent'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={autoSelected.has(m.entitySlug)}
                            onChange={() => toggleAutoMatch(m.entitySlug)}
                            style={{ flexShrink: 0 }}
                          />
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 500 }}>{m.entityName}</span>
                            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                              {LABELS[m.entityType]}
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                            {m.count} occorrenz{m.count === 1 ? 'a' : 'e'}
                          </span>
                        </label>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* Frontmatter */}
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

              {/* Body */}
              <pre
                onMouseUp={handleBodyMouseUp}
                style={{
                  background: 'var(--surface)',
                  padding: 16,
                  borderRadius: 'var(--radius)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontSize: 13,
                  lineHeight: 1.6,
                  userSelect: 'text',
                  cursor: 'text'
                }}
              >
                {selected.body}
              </pre>
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--text-muted)', marginTop: 80, textAlign: 'center' }}>
            Seleziona un'entità dall'archivio
          </div>
        )}
      </div>
    </div>
  )
}
