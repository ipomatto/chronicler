import { EntityRow, EntityType } from './data'

export type LogLevel = 'info' | 'success' | 'warn' | 'error'

export type LogEntry = {
  id: number
  ts: string
  level: LogLevel
  msg: string
  details?: string
}

export type SimStep =
  | { type: 'log'; entry: LogEntry }
  | { type: 'progress'; percent: number }
  | { type: 'entity'; slug: string; status: 'synced' | 'pending' | 'error'; uuid?: string; error?: string }
  | { type: 'done' }

let nextId = 0

export function makeEntry(level: LogLevel, msg: string, details?: string): LogEntry {
  return { id: nextId++, ts: new Date().toISOString().slice(11, 19), level, msg, details }
}

const ENTITY_IT: Record<EntityType, string> = {
  characters: 'personaggi',
  locations:  'luoghi',
  factions:   'fazioni',
  events:     'eventi',
}

export function buildSeedSequence(entities: EntityRow[], dryRun: boolean): SimStep[] {
  const steps: SimStep[] = []
  const pending = entities.filter(e => e.status === 'pending')
  const errored = entities.filter(e => e.status === 'error')

  const note = dryRun ? ' [dry-run]' : ''
  steps.push({ type: 'log', entry: makeEntry('info', `Pre-flight: lettura del manifest da World Anvil${note}`) })
  steps.push({ type: 'progress', percent: 3 })
  steps.push({ type: 'log', entry: makeEntry('info', `Manifest versione 42 — ${entities.filter(e => e.uuid).length} entita gia tracciate`) })
  steps.push({ type: 'log', entry: makeEntry('info', `Delta da creare: ${pending.length + errored.length} entita`) })
  steps.push({ type: 'progress', percent: 8 })
  steps.push({ type: 'log', entry: makeEntry('info', `Acquisizione lock sul manifest (locked_by=ws-${crypto.randomUUID().slice(0,8)})`) })
  steps.push({ type: 'progress', percent: 12 })
  steps.push({ type: 'log', entry: makeEntry('success', 'Lock acquisito — avvio Phase 1b') })

  const order: EntityType[] = ['locations', 'factions', 'characters', 'events']
  const toCreate = [...pending, ...errored]
  const total = toCreate.length
  const perEntityWeight = 70 / Math.max(total, 1)
  let progress = 12
  let doneSoFar = 0

  for (const type of order) {
    const group = toCreate.filter(e => e.type === type)
    if (group.length === 0) continue
    steps.push({ type: 'log', entry: makeEntry('info', `Pass 1: creazione di ${group.length} ${ENTITY_IT[type]}`) })
    for (const e of group) {
      progress += perEntityWeight
      doneSoFar++
      if (e.slug === 'lyra-venticanto' && !dryRun) {
        steps.push({ type: 'log', entry: makeEntry('warn', `POST /article "${e.name}" → 429, retry 1/5 in 2.3s`) })
        steps.push({ type: 'log', entry: makeEntry('warn', `POST /article "${e.name}" → 429, retry 5/5 abbandonato`, `{\n  "status": 429,\n  "response": "Too Many Requests",\n  "retry_after": 120\n}`) })
        steps.push({ type: 'entity', slug: e.slug, status: 'error', error: '429 rate limit dopo 5 retry' })
        steps.push({ type: 'log', entry: makeEntry('error', `Saltato "${e.name}" — restera in stato "errore"`) })
        continue
      }
      const fakeUuid = `${type[0]}${doneSoFar}-${Math.random().toString(16).slice(2, 8)}`
      steps.push({ type: 'log', entry: makeEntry('success', `POST /article "${e.name}" → ${fakeUuid}${dryRun ? ' (simulato)' : ''}`) })
      steps.push({ type: 'entity', slug: e.slug, status: 'synced', uuid: fakeUuid })
      steps.push({ type: 'progress', percent: Math.min(progress, 82) })
    }
  }

  steps.push({ type: 'progress', percent: 85 })
  steps.push({ type: 'log', entry: makeEntry('info', 'Pass 2: risoluzione link cross-entita e wiki-link') })
  steps.push({ type: 'log', entry: makeEntry('info', 'PATCH 3 luoghi con parentLocation') })
  steps.push({ type: 'log', entry: makeEntry('info', 'PATCH 2 personaggi con currentLocation') })
  steps.push({ type: 'progress', percent: 92 })
  steps.push({ type: 'log', entry: makeEntry('info', 'Phase 2: commit del manifest (versione 42 → 43)') })
  steps.push({ type: 'log', entry: makeEntry('success', 'Manifest aggiornato, lock rilasciato') })
  steps.push({ type: 'progress', percent: 100 })
  steps.push({ type: 'log', entry: makeEntry('success', 'Sincronizzazione completata') })
  steps.push({ type: 'done' })
  return steps
}

export function buildVerifySequence(entities: EntityRow[]): SimStep[] {
  const steps: SimStep[] = []
  steps.push({ type: 'log', entry: makeEntry('info', 'Verifica: lettura del manifest e degli articoli del mondo World Anvil') })
  steps.push({ type: 'progress', percent: 30 })
  steps.push({ type: 'log', entry: makeEntry('info', `Voci nel manifest: ${entities.filter(e => e.uuid).length}`) })
  steps.push({ type: 'progress', percent: 65 })
  steps.push({ type: 'log', entry: makeEntry('success', 'Manifest ↔ articoli World Anvil: coerenti (0 orfani, 0 mancanti)') })
  steps.push({ type: 'progress', percent: 100 })
  steps.push({ type: 'done' })
  return steps
}

export function buildResetSequence(entities: EntityRow[]): SimStep[] {
  const steps: SimStep[] = []
  steps.push({ type: 'log', entry: makeEntry('warn', `Reset: ${entities.length} entita marcate come "in attesa"`) })
  steps.push({ type: 'progress', percent: 50 })
  for (const e of entities) {
    if (e.status !== 'pending') steps.push({ type: 'entity', slug: e.slug, status: 'pending' })
  }
  steps.push({ type: 'progress', percent: 100 })
  steps.push({ type: 'log', entry: makeEntry('success', 'Cache locale resettata — il prossimo Seed risincronizzera tutto') })
  steps.push({ type: 'done' })
  return steps
}
