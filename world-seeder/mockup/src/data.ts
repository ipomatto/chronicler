export type EntityType = 'characters' | 'locations' | 'factions' | 'events'
export type SyncStatus = 'synced' | 'pending' | 'error'

export type EntityRow = {
  slug: string
  name: string
  type: EntityType
  status: SyncStatus
  uuid?: string
  error?: string
}

export const ENTITY_LABEL: Record<EntityType, string> = {
  characters: 'Personaggi',
  locations: 'Luoghi',
  factions: 'Fazioni',
  events: 'Eventi',
}

export type WorldInfo = {
  name: string
  uuid: string
  description: string
  totalArticles: number
  manifestVersion: number
  lastActivity: string
  createdAt: string
}

export const SAMPLE_WORLD: WorldInfo = {
  name: 'Il Reame di Valmar',
  uuid: 'a3b9c2d1-wrld-4e2f-9abc-0123456789ab',
  description: 'Terre del Nord, antiche fortezze e gilde segrete',
  totalArticles: 28,
  manifestVersion: 42,
  lastActivity: '3 ore fa',
  createdAt: '2024-03-12',
}

export const INITIAL_ENTITIES: EntityRow[] = [
  { slug: 'caelen-tempestosa', name: 'Caelen Tempestosa', type: 'characters', status: 'synced', uuid: 'c1a-…' },
  { slug: 'valdris-il-saggio', name: 'Valdris il Saggio', type: 'characters', status: 'synced', uuid: 'c2b-…' },
  { slug: 'mira-ombrascura', name: 'Mira Ombrascura', type: 'characters', status: 'pending' },
  { slug: 'torgrim-barbaforte', name: 'Torgrim Barbaforte', type: 'characters', status: 'pending' },
  { slug: 'lyra-venticanto', name: 'Lyra Venticanto', type: 'characters', status: 'error', error: '429 rate limit dopo 5 retry' },
  { slug: 'porto-della-luna', name: 'Porto della Luna', type: 'locations', status: 'synced', uuid: 'l1-…' },
  { slug: 'cripte-di-valmar', name: 'Cripte di Valmar', type: 'locations', status: 'synced', uuid: 'l2-…' },
  { slug: 'foresta-sibilante', name: 'Foresta Sibilante', type: 'locations', status: 'pending' },
  { slug: 'gilda-dei-velati', name: 'Gilda dei Velati', type: 'factions', status: 'synced', uuid: 'f1-…' },
  { slug: 'ordine-del-cigno', name: 'Ordine del Cigno', type: 'factions', status: 'synced', uuid: 'f2-…' },
  { slug: 'incendio-del-porto', name: '00003 — Incendio del Porto', type: 'events', status: 'synced', uuid: 'e1-…' },
  { slug: 'assedio-di-valmar', name: '00004 — Assedio di Valmar', type: 'events', status: 'pending' },
]

export function tallyByType(entities: EntityRow[]) {
  const base: Record<EntityType, Record<SyncStatus, number>> = {
    characters: { synced: 0, pending: 0, error: 0 },
    locations:  { synced: 0, pending: 0, error: 0 },
    factions:   { synced: 0, pending: 0, error: 0 },
    events:     { synced: 0, pending: 0, error: 0 },
  }
  for (const e of entities) base[e.type][e.status]++
  return base
}

export type ActionKey = 'seed' | 'sync' | 'verify' | 'reset'

export type ActionSpec = {
  label: string
  variant: 'primary' | 'secondary' | 'ghost' | 'danger'
  title: string
  description: string
  confirmLabel: string
  readOnly?: boolean
}

export const ACTIONS: Record<ActionKey, ActionSpec> = {
  seed: {
    label: 'Seed completo',
    variant: 'primary',
    title: 'Avviare il seed completo?',
    description: 'Il seed legge tutte le entita locali, le confronta con il manifest remoto su World Anvil, crea le nuove come draft e risolve i link incrociati (Pass 1 + Pass 2), poi aggiorna il manifest.\n\nPuo richiedere alcuni minuti in base al numero di entita. Se il dry-run e attivo, tutto viene simulato senza scrivere su WA.',
    confirmLabel: 'Avvia seed',
  },
  sync: {
    label: 'Sync incrementale',
    variant: 'secondary',
    title: 'Avviare la sincronizzazione incrementale?',
    description: 'Sincronizza solo le entita modificate dall\'ultimo run (in stato "in attesa" o "errore"). Non tocca le entita gia sincronizzate e coerenti con il manifest.\n\nPiu veloce del seed completo, adatto all\'uso quotidiano.',
    confirmLabel: 'Avvia sync',
  },
  verify: {
    label: 'Verifica',
    variant: 'ghost',
    title: 'Verificare la coerenza con World Anvil?',
    description: 'Legge il manifest remoto e lo confronta con gli articoli effettivamente presenti su World Anvil. Operazione di sola lettura: non modifica nulla ne su WA ne in locale.\n\nSegnala articoli orfani (su WA ma non nel manifest) e voci del manifest con UUID ormai inesistenti.',
    confirmLabel: 'Avvia verifica',
    readOnly: true,
  },
  reset: {
    label: 'Reset',
    variant: 'danger',
    title: 'Resettare la cache locale?',
    description: 'Marca tutte le entita locali come "in attesa" e svuota la cache di mapping. Al prossimo seed verranno tutte ri-verificate contro il manifest remoto.\n\nATTENZIONE: non cancella articoli gia presenti su World Anvil — il manifest resta la fonte di verita. Questo comando e utile se la cache locale si e desincronizzata.',
    confirmLabel: 'Resetta cache',
  },
}
