import { ActionKey, ACTIONS, EntityRow, ENTITY_LABEL, EntityType, WorldInfo, tallyByType } from '../data'

type Props = {
  world: WorldInfo
  entities: EntityRow[]
  progress: number
  running: boolean
  lastSync: string | null
  dryRun: boolean
  onToggleDryRun: (v: boolean) => void
  onAction: (key: ActionKey) => void
}

const TYPES: EntityType[] = ['characters', 'locations', 'factions', 'events']
const ACTION_KEYS: ActionKey[] = ['seed', 'sync', 'verify', 'reset']

export function SyncDashboard(p: Props) {
  const tally = tallyByType(p.entities)
  const totalErrors  = TYPES.reduce((acc, t) => acc + tally[t].error,   0)
  const totalPending = TYPES.reduce((acc, t) => acc + tally[t].pending, 0)
  const totalSynced  = TYPES.reduce((acc, t) => acc + tally[t].synced,  0)
  const hasSyncWork = totalPending + totalErrors > 0

  return (
    <div>
      <div className="world-card">
        <div className="world-main">
          <div className="world-name">{p.world.name}</div>
          <div className="world-desc">{p.world.description}</div>
        </div>
        <div className="world-meta">
          <div><span className="label">Articoli su World Anvil</span> <b>{p.world.totalArticles}</b></div>
          <div><span className="label">Manifest</span> <b>v{p.world.manifestVersion}</b></div>
          <div><span className="label">Ultima attivita</span> <b>{p.world.lastActivity}</b></div>
        </div>
      </div>

      <div className="dash-top">
        <div className="last-sync">
          Ultimo sync locale: {p.lastSync ?? 'mai'}
          {totalErrors > 0  && <> · <span style={{ color: 'var(--err)' }}>{totalErrors} errori</span></>}
          {totalPending > 0 && <> · <span style={{ color: 'var(--warn)' }}>{totalPending} in attesa</span></>}
          {totalSynced > 0  && totalPending + totalErrors === 0 && <> · <span style={{ color: 'var(--ok)' }}>tutto allineato</span></>}
        </div>
        <div className="action-row">
          <label className={`switch ${p.dryRun ? 'on' : ''}`} title="Simula senza scrivere su World Anvil">
            <input
              type="checkbox"
              checked={p.dryRun}
              onChange={e => p.onToggleDryRun(e.target.checked)}
              disabled={p.running}
            />
            <span className="switch-track"><span className="switch-thumb" /></span>
            <span className="switch-label">dry-run</span>
          </label>
          <div className="actions">
            {ACTION_KEYS.map(k => {
              const a = ACTIONS[k]
              const disabled = p.running || (k === 'sync' && !hasSyncWork)
              return (
                <button
                  key={k}
                  className={a.variant}
                  disabled={disabled}
                  onClick={() => p.onAction(k)}
                  title={a.description.split('\n')[0]}
                >
                  {a.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {(p.running || p.progress > 0) && (
        <div className="progress"><div style={{ width: `${p.progress}%` }} /></div>
      )}

      <div className="cards">
        {TYPES.map(t => (
          <div key={t} className="card">
            <h3>{ENTITY_LABEL[t]}</h3>
            <div className="row synced">
              <span className="label"><span className="dot" style={{ color: 'var(--ok)' }} /> Sincronizzati</span>
              <span className="count">{tally[t].synced}</span>
            </div>
            <div className="row pending">
              <span className="label"><span className="dot" style={{ color: 'var(--warn)' }} /> In attesa</span>
              <span className="count">{tally[t].pending}</span>
            </div>
            <div className="row error">
              <span className="label"><span className="dot" style={{ color: 'var(--err)' }} /> Errore</span>
              <span className="count">{tally[t].error}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
