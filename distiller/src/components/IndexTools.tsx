import { useState } from 'react'
import type { IndexStats } from '../types/entities'

const LABELS: Record<string, string> = {
  characters: 'Personaggi',
  locations: 'Luoghi',
  factions: 'Fazioni',
  events: 'Eventi'
}

const ICONS: Record<string, string> = {
  characters: '👤',
  locations: '📍',
  factions: '⚔️',
  events: '📅'
}

export default function IndexTools() {
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<IndexStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleRebuild() {
    setLoading(true)
    setError(null)
    setStats(null)
    try {
      const result = await window.chronicler.rebuildIndex()
      setStats(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore durante la ricostruzione.')
    } finally {
      setLoading(false)
    }
  }

  const formattedDate = stats
    ? new Date(stats.rebuiltAt).toLocaleString('it-IT', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })
    : null

  return (
    <div style={{ maxWidth: 540, margin: '48px auto', padding: '0 24px' }}>
      <h2 style={{ marginBottom: 4 }}>Strumenti</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 32 }}>
        Operazioni di manutenzione sull'archivio.
      </p>

      {/* Rebuild Index card */}
      <div style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden'
      }}>
        {/* Card header */}
        <div style={{
          padding: '14px 20px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Ricostruisci Indice</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Riscansiona tutte le cartelle e rigenera <code>data/index.md</code>
            </div>
          </div>
          <button
            onClick={handleRebuild}
            disabled={loading}
            style={{
              padding: '6px 18px',
              background: loading ? 'var(--surface2)' : 'var(--accent)',
              color: loading ? 'var(--text-muted)' : '#fff',
              border: 'none',
              borderRadius: 'var(--radius)',
              cursor: loading ? 'default' : 'pointer',
              fontSize: 13,
              flexShrink: 0
            }}
          >
            {loading ? 'Ricostruzione…' : 'Ricostruisci'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '12px 20px', color: '#e05c5c', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Indice ricostruito il {formattedDate}
            </div>

            {/* Per-type rows */}
            {(Object.keys(LABELS) as Array<keyof typeof LABELS>).map((type) => {
              const count = stats.counts[type as keyof typeof stats.counts] ?? 0
              return (
                <div
                  key={type}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border)',
                    fontSize: 14
                  }}
                >
                  <span>
                    <span style={{ marginRight: 8 }}>{ICONS[type]}</span>
                    {LABELS[type]}
                  </span>
                  <span style={{
                    fontWeight: 600,
                    fontSize: 18,
                    color: count > 0 ? 'var(--accent)' : 'var(--text-muted)'
                  }}>
                    {count}
                  </span>
                </div>
              )
            })}

            {/* Total */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 0 0',
              fontSize: 14,
              fontWeight: 600
            }}>
              <span>Totale entità</span>
              <span style={{ fontSize: 22, color: 'var(--accent)' }}>{stats.total}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
