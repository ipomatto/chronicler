# Distiller - Specifiche Modulo

Electron + React app per processare recap di sessione D&D, estrarre entita via LLM, e gestire la knowledge base.

## Architettura

```
distiller/
├── electron/                  # Main process
│   ├── main.ts                # Entry point, window, DevTools (config/env)
│   ├── preload.ts             # Context bridge (window.chronicler)
│   ├── services/
│   │   ├── storage.ts         # CRUD su file .md (gray-matter)
│   │   ├── llm.ts             # Client LLM (Anthropic, OpenAI, Ollama)
│   │   ├── matcher.ts         # Fuzzy entity matching (Fuse.js)
│   │   └── sessionFingerprint.ts  # SimHash anti-duplicato sessione
│   └── ipc/
│       └── handlers.ts        # IPC handlers esposti al renderer
├── src/                       # Renderer (React)
│   ├── App.tsx
│   ├── components/
│   │   ├── SessionInput.tsx       # Input testo + selettore modello + token usage
│   │   ├── ExtractionReview.tsx   # Review per categoria
│   │   ├── EntityCard.tsx         # Preview/edit singola entita
│   │   ├── EntityDiff.tsx         # Diff side-by-side per update
│   │   ├── EntityCreator.tsx      # Form guidato per nuove entita
│   │   ├── EntityEditor.tsx       # Editor entita esistenti
│   │   ├── StorageBrowser.tsx     # Browser entita + auto-link
│   │   └── Settings.tsx           # Config LLM, storage path
│   ├── hooks/
│   │   ├── useExtraction.ts       # Pipeline estrazione (4 chiamate parallele)
│   │   ├── useStorage.ts          # CRUD via IPC
│   │   └── useMatching.ts         # Matching e disambiguazione
│   ├── types/
│   │   └── entities.ts            # Tipi TypeScript (tutti i tipi entita)
│   └── lib/
│       └── markdown.ts            # Parsing/serializzazione .md
└── tests/
```

## Formato entita (condiviso con Storage e World Seeder)

Ogni entita e' un file `.md` con YAML frontmatter + body Markdown con `[[wiki-links]]`.

### Character

```yaml
name: string
slug: string           # kebab-case, ASCII-only
type: character
category: pc | npc
status: alive | dead | missing | unknown
race: string
class: string
aliases: string[]
tags: string[]
last_updated: string   # ISO date
sessione: string       # UUID sessione di estrazione
```

Sezioni body: `## Description`, `## Background`, `## Notable Items`, `## Key Events`, `## Notes`

### Location

```yaml
name: string
slug: string
type: location
category: city | town | village | dungeon | region | wilderness | landmark | building
parent_location: string   # wiki-link es. "[[Regno di Ashenmoor]]"
status: active | destroyed | abandoned | contested | unknown
tags: string[]
last_updated: string
```

Sezioni body: `## Description`, `## Notable Features`, `## History`, `## Key Events`, `## Notes`

### Faction

```yaml
name: string
slug: string
type: faction
category: political | military | religious | criminal | mercantile | arcane | other
status: active | disbanded | secret | destroyed | unknown
base_of_operations: string   # wiki-link
tags: string[]
last_updated: string
```

Sezioni body: `## Description`, `## Known Members`, `## Goals`, `## Relations`, `## Key Events`, `## Notes`

### Event

```yaml
name: string
slug: string           # prefisso 5-digit: "00003-incendio-del-porto.md"
type: event
timetrack: number      # intero cronologico globale, auto-incrementato
category: combat | social | exploration | discovery | political | catastrophe | ritual | other
date_in_world: string  # data in-game, testo libero
location: string       # wiki-link
tags: string[]
last_updated: string
```

Sezioni body: `## Summary`, `## Participants`, `## Consequences`, `## Notes`

## Flusso estrazione

```
Input testo recap
    |
    v
[SimHash fingerprint check] -- duplicato? --> avviso utente
    |
    v
4 chiamate LLM parallele (characters, locations, factions, events)
    |  Ogni chiamata riceve: testo + known_entities + JSON schema
    |  Token usage accumulato e mostrato live
    v
Post-LLM matcher validation (issue #3)
    |  Per ogni entita NEW: matcher.findSimilarEntities()
    |  score >= 0.95 --> auto-match
    |  score 0.4-0.94 --> AMBIGUOUS
    |  score < 0.4 --> NEW
    v
Review UI per categoria
    |  UPDATE: diff field-by-field
    |  NEW: form guidato (campi mancanti)
    |  AMBIGUOUS: disambiguazione utente
    v
Salvataggio su disco
```

## Tipi TypeScript chiave

```typescript
type EntityType = 'characters' | 'locations' | 'factions' | 'events'
type Provider = 'openai' | 'anthropic' | 'ollama'

interface ExtractionResult {
  entity_type: EntityType
  entities: ExtractedEntity[]
  usage: TokenUsage | null
}

interface ExtractedEntity {
  name: string
  matched_slug: string | null
  possible_matches: string[]
  confidence: number
  extracted_data: {
    frontmatter: Partial<Record<string, unknown>>
    body_sections: BodySection[]
  }
  reasoning: string
}

interface TokenUsage { input: number; output: number }
interface EntityFile { frontmatter: Record<string, unknown>; body: string }
interface MatchCandidate { slug: string; name: string; aliases: string[]; score: number; reason: string }
```

## Storage Service API (main process)

```typescript
// Read
listEntities(entityType): Promise<EntitySummary[]>
getEntity(entityType, slug): Promise<EntityFile>
searchEntities(query): Promise<EntitySummary[]>

// Write
createEntity(entityType, content): Promise<void>
updateEntity(entityType, slug, content): Promise<void>

// Matching
findSimilarEntities(name, entityType): Promise<MatchCandidate[]>
entityExists(entityType, slug): Promise<boolean>

// Utilities
resolveWikiLinks(text): Promise<ResolvedLink[]>
generateSlug(name, entityType): Promise<string>
getNextEventTimetrack(): Promise<number>
findUnlinkedOccurrences(body): Promise<UnlinkedMatch[]>
rebuildIndex(): Promise<IndexStats>

// Session fingerprint
checkFingerprint(recapText): Promise<FingerprintMatch | null>
recordFingerprint(sessione, recapText): Promise<void>
```

## Entity Matching (matcher.ts)

Priorita di matching:
1. **Exact name** - case-insensitive (score 1.0)
2. **Alias match** - qualsiasi alias (score 0.95)
3. **Partial match** - contenuto nel nome (score * 0.85)
4. **Fuzzy (Fuse.js)** - threshold 0.4, max 5 candidati

## Regole di update

**Frontmatter aggiornabili da recap**: `status`, `tags` (solo aggiunta), `aliases` (solo aggiunta), `last_updated`

**Frontmatter immutabili**: `name`, `slug`, `type`, `category`, `race`, `class`, `base_of_operations`, `parent_location`

**Body**: `Key Events`, `Notes`, `Known Members`, `Notable Features` = append only. `Description`, `Background`, `History` = solo edit manuale.

## Configurazione

- `config/app.json` - dataPath, fuzzyThreshold, maxCandidates, language, devtools, fingerprintThreshold
- `config/llm.json` - providers (openai, anthropic, ollama), models, temperatures
- API keys criptate via Electron `safeStorage`
- Prompts esterni in `prompts/{provider}/extract-{type}.md`

## Dipendenze runtime

| Pacchetto | Scopo |
|-----------|-------|
| `@anthropic-ai/sdk` | Client Anthropic |
| `openai` | Client OpenAI + Ollama |
| `gray-matter` | Parsing YAML frontmatter |
| `fuse.js` | Fuzzy search |

## Comandi

```bash
npm install          # Installa dipendenze
npm run dev          # Dev mode (electron-vite dev)
npm run build        # Build produzione
npm run package      # Build + installer (.exe/.dmg/.AppImage)
npm test             # Vitest
```
