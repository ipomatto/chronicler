# World Seeder - Specifiche Modulo

Electron + React app per sincronizzare le entita narrative di Chronicler verso World Anvil via API Boromir. Stesso stack e design system del Distiller.

## Architettura

```
world-seeder/
├── electron/
│   ├── main.ts                # Entry point, window
│   ├── preload.ts             # Context bridge
│   ├── services/
│   │   ├── waClient.ts        # Wrapper API Boromir (GET, POST, PATCH)
│   │   ├── dbReader.ts        # Lettura entita .md da data/ (gray-matter)
│   │   ├── mapper.ts          # Frontmatter+body -> WA payload JSON
│   │   ├── bbcode.ts          # Markdown -> BBCode
│   │   ├── syncEngine.ts      # Orchestrazione two-pass, retry, rate limit
│   │   └── mappingStore.ts    # wa_sync SQLite (better-sqlite3)
│   └── ipc/
│       └── handlers.ts        # IPC handlers
├── src/
│   ├── App.tsx                # Layout a tab: Dashboard / Log / Config
│   ├── components/
│   │   ├── SyncDashboard.tsx  # Vista principale: status, conteggi, azioni
│   │   ├── ConfigPanel.tsx    # API keys, World ID, rate limit, dry-run
│   │   └── SyncLog.tsx        # Log live color-coded con dettagli errori
│   └── types/
│       └── seeder.ts          # Tipi TypeScript
├── package.json
├── electron-builder.json
└── electron.vite.config.ts
```

## Pipeline two-pass

Il sistema usa un approccio a due passate per gestire le dipendenze circolari tra entita:

```
Pass 1: POST tutte le entita SENZA link cross-entita
        |  Ordine: locations -> factions -> characters -> events
        |  Ogni POST restituisce un UUID da WA
        |  UUID salvato nella mapping table
        v
Pass 2: PATCH ogni entita CON link risolti
        |  Wiki-links [[Nome]] risolti in UUID WA via mapping table
        |  Campi UUID (currentLocation, parentLocation, etc.) popolati
        v
Sync completato
```

### Ordine di creazione (Pass 1)

| # | Chronicler type | WA entityClass  | Dipendenze          |
|---|-----------------|-----------------|---------------------|
| 1 | locations       | Location        | Nessuna             |
| 2 | factions        | Organization    | Locations           |
| 3 | characters      | Person          | Locations, Factions |
| 4 | events          | HistoricalEvent | Locations, Characters |

## API World Anvil (Boromir)

### Autenticazione

Ogni richiesta richiede due header:

```
x-application-key: <APPLICATION_KEY>    # piano Grandmaster+
x-auth-token:      <USER_AUTH_TOKEN>    # piano Master+
```

Chiavi salvate criptate via Electron `safeStorage`, configurate tramite ConfigPanel.

### Endpoint

| Operazione | Metodo | Endpoint | Note |
|------------|--------|----------|------|
| Crea articolo | POST | `/article` | Richiede worldId, title, entityClass |
| Aggiorna | PATCH | `/article/{uuid}` | Solo campi inviati |
| Leggi | GET | `/article/{uuid}` | `granularity` per dettaglio |
| Lista mondo | GET | `/world/{uuid}/articles` | Paginato |
| Cancella | DELETE | `/article/{uuid}` | Usare con cautela |

### Payload base (comune a tutti)

```json
{
  "title": "...",
  "entityClass": "...",
  "worldId": "uuid",
  "categoryId": "uuid",
  "content": "BBCode...",
  "excerpt": "...",
  "isDraft": true,
  "tags": "tag1,tag2"
}
```

### Problemi noti

- **Cloudflare**: puo bloccare richieste senza User-Agent -> usare `WorldSeeder/1.0`
- **API in beta**: breaking changes possibili con 3 mesi di preavviso
- **Nessun webhook**: sync solo push (locale -> WA), mai pull

## Mapping entita

### Character -> Person

| Chronicler field       | WA field              | Note                         |
|------------------------|-----------------------|------------------------------|
| `name`                 | `title`               | Anche split in firstname/lastname |
| `aliases[0]`           | `nickname`            |                              |
| `frontmatter.race`     | `species`             | UUID se species esiste su WA |
| `frontmatter.status`   | `deathDate`           | null se alive                |
| `## Description`       | `content` (BBCode)    | Body principale              |
| `## Background`        | `history` (BBCode)    |                              |
| `## Notable Items`     | `personalPossessions` |                              |
| wiki-links a locations | `currentLocation`     | UUID via mapping table       |

### Location -> Location

| Chronicler field       | WA field           | Note                   |
|------------------------|--------------------|------------------------|
| `name`                 | `title`            |                        |
| `category`             | `locationType`     | city, dungeon, etc.    |
| `parent_location`      | `parentLocation`   | UUID via mapping table |
| `## Description`       | `content` (BBCode) |                        |
| `## History`           | `history` (BBCode) |                        |
| `## Notable Features`  | `pointsOfInterest` |                        |

### Faction -> Organization

| Chronicler field       | WA field          | Note                   |
|------------------------|-------------------|------------------------|
| `name`                 | `title`           |                        |
| `base_of_operations`   | `headquarters`    | UUID via mapping table |
| `## Description`       | `content` (BBCode)|                        |
| `## Known Members`     | `members` (BBCode)|                        |
| `## Goals`             | `goals` (BBCode)  |                        |

### Event -> HistoricalEvent

| Chronicler field       | WA field          | Note                   |
|------------------------|-------------------|------------------------|
| `name`                 | `title`           |                        |
| `location`             | `location`        | UUID via mapping table |
| `date_in_world`        | `startDate`       |                        |
| `## Summary`           | `content` (BBCode)|                        |
| `## Participants`      | `participants`    |                        |
| `## Consequences`      | `result` (BBCode) |                        |

> I nomi esatti dei campi WA vanno verificati con una GET `granularity=2` su un articolo esistente di quel tipo.

## Conversione Markdown -> BBCode (bbcode.ts)

| Markdown | BBCode |
|----------|--------|
| `## Header` | `[h2]Header[/h2]` |
| `### Header` | `[h3]Header[/h3]` |
| `**bold**` | `[b]bold[/b]` |
| `*italic*` | `[i]italic[/i]` |
| `- item` | `[ul][li]item[/li][/ul]` |
| `[[Entity]]` | `[article:UUID]` (risolto via mapping table) |
| `[text](url)` | `[url=url]text[/url]` |

## Mapping Table (SQLite via better-sqlite3)

Percorso: `data/wa-sync.db`

```sql
CREATE TABLE wa_sync (
    db_id        TEXT    PRIMARY KEY,   -- slug entita
    entity_type  TEXT    NOT NULL,      -- 'characters' | 'locations' | 'factions' | 'events'
    wa_uuid      TEXT    UNIQUE,        -- UUID assegnato da WA
    wa_url       TEXT,                  -- URL articolo su WA
    synced_at    TIMESTAMP,            -- ultimo sync riuscito
    dirty        BOOLEAN DEFAULT FALSE, -- TRUE = da risincronizzare
    error        TEXT                   -- ultimo messaggio errore
);
```

### Ciclo di vita record

| Stato | dirty | wa_uuid | Descrizione |
|-------|-------|---------|-------------|
| Nuovo | TRUE | NULL | Entita nel DB, non ancora su WA |
| Sincronizzato | FALSE | presente | Allineato |
| Modificato | TRUE | presente | DB aggiornato, PATCH pendente |
| In errore | TRUE | qualsiasi | Ultimo tentativo fallito |

### Trigger del dirty flag

- Nuova entita nel DB locale
- Modifica di qualsiasi campo
- Cambio di una relazione (es. location di un personaggio)
- Reset manuale via UI

## Interfaccia utente

### SyncDashboard (tab principale)

- Conteggi entita per tipo, raggruppati per stato:
  - Sincronizzate (verde #22c55e)
  - Pendenti/dirty (ambra #fbbf24)
  - In errore (rosso #f87171)
- Timestamp ultimo sync riuscito
- Bottoni: **Seed** (full sync), **Sync** (incrementale), **Reset** (con conferma), **Verify**
- Barra progresso durante sync
- Indicatore dry-run

### ConfigPanel (tab configurazione)

- **Application Key** — input mascherato, safeStorage
- **Auth Token** — input mascherato, safeStorage
- **World ID** — UUID mondo WA
- **Rate limit delay** — slider 0.1-2.0s (default 0.5s)
- **Dry-run** — toggle
- **Test connessione** — verifica credenziali

### SyncLog (tab log)

- Pannello scrollabile con aggiornamenti live
- Color-coded: info (grigio), success (verde), warning (ambra), error (rosso)
- Dettagli errore espandibili (response body API)
- Filtro per livello
- Bottone "Copia log"
- Auto-scroll con blocco manuale

## Gestione errori

| Errore | Comportamento |
|--------|---------------|
| 429 Rate Limit | Exponential backoff + jitter, max 5 retry |
| 403 Cloudflare | Retry con User-Agent + delay 30s |
| 404 Not Found | Reset wa_uuid, ricrea al prossimo run |
| 5xx Server | Retry con backoff, max 3, poi skip |
| Errore rete | Retry 1x, poi skip con log |
| Errore mapping | Log critico, skip entita, continua |

Tutti gli errori mostrati nel SyncLog con dettagli completi.

## Formato entita (input da data/)

Stesso formato del Distiller. Vedi `distiller/SPEC.md` per gli schemi frontmatter completi di character, location, faction, event.

Chiave: il body va splittato per sezione (`## Header`) e ogni sezione mappata sul campo WA corrispondente (vedi tabelle mapping sopra).

## Configurazione

- API keys WA: criptate via Electron `safeStorage` (ConfigPanel)
- `config/app.json`: legge `storage.dataPath` per trovare i file .md
- `config/world-seeder.json`: World ID, rate limit delay, dry-run (creato dal ConfigPanel)

## Tech stack

| Componente | Scelta | Motivazione |
|------------|--------|-------------|
| Desktop shell | Electron | Stesso del Distiller |
| Frontend | React + TypeScript | Stesso del Distiller |
| Build | electron-vite + electron-builder | Stesso del Distiller |
| HTTP | Node.js fetch | Built-in |
| SQLite | better-sqlite3 | Sincrono, veloce, nativo |
| Parsing .md | gray-matter | Stesso del Distiller |
| API keys | Electron safeStorage | Stesso del Distiller |
| Test | vitest | Stesso del Distiller |

## Comandi

```bash
npm install          # Installa dipendenze
npm run dev          # Dev mode
npm run build        # Build produzione
npm run package      # Build + installer
npm test             # Vitest
```
