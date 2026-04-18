import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ACTIONS, ActionKey, INITIAL_ENTITIES, EntityRow, SAMPLE_WORLD } from './data'
import { LogEntry, SimStep, buildResetSequence, buildSeedSequence, buildVerifySequence } from './simulator'
import { SyncDashboard } from './components/SyncDashboard'
import { ConfigPanel } from './components/ConfigPanel'
import { SyncLog } from './components/SyncLog'
import { ConfirmDialog } from './components/ConfirmDialog'
import { NotConfigured } from './components/NotConfigured'

type Tab = 'dashboard' | 'log' | 'config'

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [entities, setEntities] = useState<EntityRow[]>(INITIAL_ENTITIES)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [progress, setProgress] = useState(0)
  const [running, setRunning] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>('2026-04-18 21:04')
  const [dryRun, setDryRun] = useState(false)
  const [connected, setConnected] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [pendingAction, setPendingAction] = useState<ActionKey | null>(null)
  const cancelRef = useRef(false)

  useEffect(() => {
    if (!configured) setTab('config')
  }, [configured])

  const runSteps = useCallback(async (steps: SimStep[], switchToLog = true) => {
    if (running) return
    setRunning(true)
    cancelRef.current = false
    if (switchToLog) setTab('log')
    for (const step of steps) {
      if (cancelRef.current) break
      await new Promise(r => setTimeout(r, 120))
      if (step.type === 'log') {
        setLogs(l => [...l, step.entry])
      } else if (step.type === 'progress') {
        setProgress(step.percent)
      } else if (step.type === 'entity') {
        setEntities(prev => prev.map(e =>
          e.slug === step.slug
            ? { ...e, status: step.status, uuid: step.uuid ?? e.uuid, error: step.error }
            : e,
        ))
      } else if (step.type === 'done') {
        setLastSync(new Date().toISOString().slice(0, 16).replace('T', ' '))
        await new Promise(r => setTimeout(r, 400))
        setProgress(0)
      }
    }
    setRunning(false)
  }, [running])

  const confirmPending = useCallback(() => {
    const key = pendingAction
    setPendingAction(null)
    if (!key) return
    setLogs([])
    if (key === 'seed')   void runSteps(buildSeedSequence(entities, dryRun))
    if (key === 'sync')   void runSteps(buildSeedSequence(entities, dryRun))
    if (key === 'verify') void runSteps(buildVerifySequence(entities))
    if (key === 'reset')  void runSteps(buildResetSequence(entities), false)
  }, [pendingAction, entities, dryRun, runSteps])

  const onSaveConfig = useCallback(() => {
    setConfigured(true)
    setConnected(true)
    setTab('dashboard')
  }, [])

  const statusBadge = useMemo(() => {
    if (!configured) return { cls: 'badge disconnected', label: 'Non configurato' }
    if (!connected)  return { cls: 'badge disconnected', label: 'Non connesso' }
    return { cls: 'badge connected', label: 'Connesso a World Anvil' }
  }, [configured, connected])

  return (
    <div className="app">
      <header className="header">
        <h1>World Seeder</h1>
        <div className="badges">
          {dryRun && <span className="badge dry"><span className="dot" /> dry-run</span>}
          <span className={statusBadge.cls}><span className="dot" /> {statusBadge.label}</span>
        </div>
      </header>

      <nav className="tabs">
        <div className={`tab ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>Dashboard</div>
        <div className={`tab ${tab === 'log' ? 'active' : ''}`} onClick={() => setTab('log')}>Log</div>
        <div className={`tab ${tab === 'config' ? 'active' : ''}`} onClick={() => setTab('config')}>Configurazione</div>
      </nav>

      <div className="main">
        {tab === 'dashboard' && (
          configured ? (
            <SyncDashboard
              world={SAMPLE_WORLD}
              entities={entities}
              progress={progress}
              running={running}
              lastSync={lastSync}
              dryRun={dryRun}
              onToggleDryRun={setDryRun}
              onAction={setPendingAction}
            />
          ) : (
            <NotConfigured onGoToConfig={() => setTab('config')} />
          )
        )}
        {tab === 'log' && (
          configured ? (
            <SyncLog logs={logs} running={running} progress={progress} />
          ) : (
            <NotConfigured onGoToConfig={() => setTab('config')} />
          )
        )}
        {tab === 'config' && (
          <ConfigPanel
            configured={configured}
            connected={connected}
            onConnectedChange={setConnected}
            onSave={onSaveConfig}
          />
        )}
      </div>

      <ConfirmDialog
        action={pendingAction ? ACTIONS[pendingAction] : null}
        dryRun={dryRun}
        onConfirm={confirmPending}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  )
}
