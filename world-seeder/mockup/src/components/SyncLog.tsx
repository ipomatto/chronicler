import { useEffect, useMemo, useRef, useState } from 'react'
import { LogEntry, LogLevel } from '../simulator'

type Props = {
  logs: LogEntry[]
  running: boolean
  progress: number
}

type Filter = 'all' | 'warn+' | 'error-only'

export function SyncLog(p: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    if (filter === 'all') return p.logs
    if (filter === 'error-only') return p.logs.filter(l => l.level === 'error')
    return p.logs.filter(l => l.level === 'warn' || l.level === 'error')
  }, [p.logs, filter])

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [p.logs, autoScroll])

  const toggle = (id: number) => {
    setExpanded(s => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const copyAll = async () => {
    const text = p.logs.map(l => `${l.ts} ${l.level.toUpperCase().padEnd(7)} ${l.msg}${l.details ? '\n  ' + l.details.replace(/\n/g, '\n  ') : ''}`).join('\n')
    try { await navigator.clipboard.writeText(text) } catch { /* noop */ }
  }

  return (
    <div>
      <div className="log-toolbar">
        <div className="left">
          <select value={filter} onChange={e => setFilter(e.target.value as Filter)}>
            <option value="all">Tutti i livelli</option>
            <option value="warn+">Avvisi ed errori</option>
            <option value="error-only">Solo errori</option>
          </select>
          <label className="toggle">
            <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} />
            <span>Auto-scroll</span>
          </label>
          <span className="counter">{filtered.length} / {p.logs.length}</span>
        </div>
        <div className="right">
          {p.running && <span className="counter">in corso · {p.progress}%</span>}
          <button className="ghost" onClick={copyAll} disabled={p.logs.length === 0}>Copia log</button>
        </div>
      </div>

      <div className="log-container" ref={containerRef}>
        {filtered.length === 0 ? (
          <div className="empty">Nessuna voce ancora. Avvia un Seed o un Sync dalla Dashboard per vedere l'output in tempo reale.</div>
        ) : (
          filtered.map(l => (
            <LogRow key={l.id} entry={l} expanded={expanded.has(l.id)} onToggle={() => toggle(l.id)} />
          ))
        )}
      </div>
    </div>
  )
}

function LogRow({ entry, expanded, onToggle }: { entry: LogEntry; expanded: boolean; onToggle: () => void }) {
  return (
    <div className={`log-entry ${entry.level}`}>
      <div className="ts">{entry.ts}</div>
      <div className="lvl">{levelLabel(entry.level)}</div>
      <div className="msg">
        {entry.msg}
        {entry.details && (
          <span className="expander" onClick={onToggle}>{expanded ? '[nascondi]' : '[dettagli]'}</span>
        )}
        {entry.details && expanded && <span className="details">{entry.details}</span>}
      </div>
    </div>
  )
}

function levelLabel(l: LogLevel): string {
  return { info: 'INFO', success: 'OK', warn: 'WARN', error: 'ERR' }[l]
}
