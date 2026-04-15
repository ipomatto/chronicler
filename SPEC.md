# Chronicler - Project Specification

## Overview

Chronicler is a system for tracking and organizing narrative content from multiple D&D campaign sessions in a shared fantasy world. It ingests unstructured session recaps, extracts structured entities (characters, locations, factions, events) via LLM, and maintains a persistent knowledge base as Obsidian-compatible Markdown files.

The system is composed of four modules:

- **Distiller** (in scope): Electron + React app that processes session text via LLM, extracts entities, and manages the knowledge base
- **Storage** (in scope): Filesystem-based structured archive of `.md` files with YAML frontmatter and `[[wiki-links]]`
- **World Seeder** (in scope): Python CLI tool that synchronizes the local entity database to World Anvil via the Boromir API
- **Viewer** (TBD): HTML-based visualization of the knowledge base - deferred to a future phase

---

## Architecture

### Tech Stack

| Component     | Technology                        |
| ------------- | --------------------------------- |
| Desktop shell | Electron                          |
| Frontend      | Vite + React + TypeScript         |
| LLM Provider  | Configurable (OpenAI / Anthropic / Ollama) |
| Storage       | Local filesystem (Markdown files) |
| Format        | Obsidian-compatible `.md`         |

### Project Structure

```
chronicler/
├── distiller/                     # Electron + React app
│   ├── electron/                  # Electron main process
│   │   ├── main.ts                # App entry, window management
│   │   ├── preload.ts             # Context bridge for renderer
│   │   ├── services/
│   │   │   ├── storage.ts         # File I/O operations on .md files
│   │   │   ├── llm.ts            # LLM API client (OpenAI / Anthropic)
│   │   │   └── matcher.ts        # Fuzzy entity matching service
│   │   └── ipc/
│   │       └── handlers.ts        # IPC handlers exposed to renderer
│   ├── src/                       # React renderer process
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── SessionInput.tsx       # Text input + model selector
│   │   │   ├── ExtractionReview.tsx   # Category-based entity review UI
│   │   │   ├── EntityCard.tsx         # Single entity preview/edit card
│   │   │   ├── EntityDiff.tsx         # Side-by-side diff for existing entities
│   │   │   ├── EntityCreator.tsx      # Guided creation form for new entities
│   │   │   ├── MatchResolver.tsx      # Disambiguation UI for fuzzy matches
│   │   │   ├── StorageBrowser.tsx     # Browse existing entities
│   │   │   └── Settings.tsx           # LLM config, storage path
│   │   ├── hooks/
│   │   │   ├── useExtraction.ts       # Orchestrates LLM extraction pipeline
│   │   │   ├── useStorage.ts          # CRUD operations via IPC
│   │   │   └── useMatching.ts         # Entity matching and disambiguation
│   │   ├── types/
│   │   │   └── entities.ts            # TypeScript types for all entity types
│   │   └── lib/
│   │       └── markdown.ts            # .md parsing/serialization (frontmatter + body)
│   ├── package.json
│   ├── electron-builder.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── world-seeder/                  # Python CLI - sync entities to World Anvil
│   ├── world_seeder/
│   │   ├── __init__.py
│   │   ├── cli.py                 # Entry point (Click)
│   │   ├── db_reader.py           # Read entities from data/ (.md files)
│   │   ├── wa_client.py           # Boromir API wrapper (GET, POST, PATCH)
│   │   ├── mapper.py              # Frontmatter+body → WA payload JSON
│   │   ├── bbcode.py              # Markdown → BBCode conversion
│   │   ├── sync_engine.py         # Two-pass orchestration, retry, errors
│   │   └── mapping_store.py       # wa_sync SQLite table persistence
│   ├── tests/
│   ├── .env.example
│   ├── requirements.txt
│   └── README.md
├── viewer/                        # TBD - placeholder for future viewer app
│   └── README.md
├── storage/                       # Shared storage configuration and schemas
│   └── templates/                 # Reference templates for each entity type
│       ├── character.md
│       ├── location.md
│       ├── faction.md
│       └── event.md
├── data/                          # Knowledge base (Obsidian-compatible vault)
│   ├── characters/
│   ├── locations/
│   ├── factions/
│   └── events/
├── prompts/                       # LLM extraction prompts (external, editable)
│   ├── openai/
│   │   ├── extract-characters.md
│   │   ├── extract-locations.md
│   │   ├── extract-factions.md
│   │   └── extract-events.md
│   └── anthropic/
│       ├── extract-characters.md
│       ├── extract-locations.md
│       ├── extract-factions.md
│       └── extract-events.md
├── config/                        # All runtime configuration (editable without rebuild)
│   ├── llm.json                   # LLM provider settings, models, parameters
│   └── app.json                   # App-level settings (storage path, language, etc.)
├── README.md
├── CLAUDE.md
└── SPEC.md
```

---

## Module 1: Storage

### Principles

- Every entity is a single `.md` file
- Files use YAML frontmatter for structured metadata
- File body uses Markdown with `[[wiki-links]]` for cross-references
- Fully compatible with Obsidian (can be opened as a vault)
- File names are kebab-case slugs derived from the entity name (e.g., `gandalf-il-grigio.md`)
- Slugs must be unique within their entity type folder

### Directory Layout

```
data/
├── characters/
│   ├── gandalf-il-grigio.md
│   └── aragorn.md
├── locations/
│   ├── minas-tirith.md
│   └── foresta-di-fangorn.md
├── factions/
│   ├── i-cavalieri-del-nord.md
│   └── gilda-dei-mercanti.md
└── events/
    ├── 00001-la-caduta-del-ponte.md
    └── 00002-assedio-di-helms-deep.md
```

### Entity Types and Templates

#### Character (`data/characters/`)

```markdown
---
name: "Thalion Ombraverde"
slug: "thalion-ombraverde"
type: character
category: npc                    # pc | npc
status: alive                    # alive | dead | missing | unknown
race: "Elfo dei boschi"
class: "Ranger"
aliases:
  - "L'Ombra"
  - "Il Cacciatore Silenzioso"
tags: []
last_updated: "2026-04-12"
---

## Description

Alto e snello, con capelli argentati e occhi color ambra. Porta sempre un mantello verde scuro e un arco lungo elfico.

## Background

Originario della [[Foresta di Mirwood]], ha lasciato il suo popolo dopo la distruzione del [[Santuario degli Antichi]]. Ora opera come guida nella regione di [[Valdris]].

## Notable Items

- **Arco di Lunargento**: arco elfico ancestrale, si dice forgiato dalla luce lunare
- **Medaglione del Patto**: simbolo della sua appartenenza alla [[Confraternita dei Sentieri]]

## Key Events

- Incontrato per la prima volta nella [[Taverna del Cervo Bianco]] durante l'evento [[00005 - Incontro alla Taverna]]
- Ha guidato il gruppo attraverso la [[Palude di Khoros]] (evento [[00008 - Traversata della Palude]])
- Ha tradito la fiducia del gruppo rivelando la posizione del campo alla [[Gilda delle Ombre]] (evento [[00012 - Il Tradimento di Thalion]])

## Notes

Sembra avere un debito non dichiarato con [[Varek il Mercante]]. Possibile doppio gioco.
```

#### Location (`data/locations/`)

```markdown
---
name: "Valdris"
slug: "valdris"
type: location
category: city                   # city | town | village | dungeon | region | wilderness | landmark | building
parent_location: "[[Regno di Ashenmoor]]"
status: active                   # active | destroyed | abandoned | contested | unknown
tags: []
last_updated: "2026-04-12"
---

## Description

Città portuale sul delta del fiume Argento. Nota per i suoi mercati affollati e le guglie del Tempio dei Venti.

## Notable Features

- **Porto Vecchio**: il quartiere dei contrabbandieri, sotto il controllo della [[Gilda delle Ombre]]
- **Tempio dei Venti**: sede del culto di Aeolos, gestito da [[Priora Selene]]
- **La Forgia Nera**: fucina nanica dove lavora [[Durak Martellofuoco]]

## History

Fondata tre secoli fa come avamposto commerciale. Ha cambiato mano diverse volte durante le Guerre dei Tre Regni.

## Key Events

- La città è stata parzialmente incendiata durante l'attacco della [[Legione Scarlatta]] (evento [[00003 - L'Incendio del Porto Vecchio]])
- Un misterioso portale si è aperto sotto il [[Porto Vecchio]] (evento [[00007 - Il Portale Sotterraneo]])

## Notes

La guarnigione cittadina è sottorganico. Il governatore [[Lord Ashwick]] sembra corrotto.
```

#### Faction (`data/factions/`)

```markdown
---
name: "Gilda delle Ombre"
slug: "gilda-delle-ombre"
type: faction
category: criminal               # political | military | religious | criminal | mercantile | arcane | other
status: active                   # active | disbanded | secret | destroyed | unknown
base_of_operations: "[[Valdris]]"
tags: []
last_updated: "2026-04-12"
---

## Description

Organizzazione criminale che controlla il mercato nero nella regione costiera. Opera nell'ombra attraverso una rete di informatori e assassini.

## Known Members

- [[Maestra Velena]] - leader, identità sconosciuta
- [[Thalion Ombraverde]] - informatore (scoperto durante evento [[00012 - Il Tradimento di Thalion]])
- [[Dito Corto]] - scassinatore e ricettatore nel [[Porto Vecchio]]

## Goals

Controllare tutte le rotte commerciali costiere e destabilizzare il governo di [[Lord Ashwick]] per sostituirlo con un fantoccio.

## Relations

- **Alleata**: [[Culto del Serpente Nero]] - alleanza segreta per scopi rituali
- **Nemica**: [[Guardia di Valdris]] - conflitto aperto nel [[Porto Vecchio]]
- **Neutrale**: [[Gilda dei Mercanti]] - rapporto di mutuo interesse economico

## Key Events

- Primo contatto con il gruppo quando hanno rubato il [[Medaglione del Patto]] (evento [[00002 - Il Furto del Medaglione]])
- Tentato assassinio di [[Lord Ashwick]] sventato dal gruppo (evento [[00009 - L'Attentato a Lord Ashwick]])

## Notes

Si dice che la Maestra Velena sia in realtà un membro della nobiltà di [[Valdris]].
```

#### Event (`data/events/`)

Events use a 5-digit zero-padded `timetrack` as the primary ordering mechanism. This tracker is auto-incremented and represents the narrative sequence in which events occurred in the world, regardless of which session or group generated them.

```markdown
---
name: "L'Incendio del Porto Vecchio"
slug: "00003-incendio-del-porto-vecchio"
type: event
timetrack: 3                     # Integer chronological tracker (displayed as 00003)
category: combat                 # combat | social | exploration | discovery | political | catastrophe | ritual | other
date_in_world: "12 Mirtul, 1492 DR"   # Optional in-game date (free text)
location: "[[Valdris]]"
tags: []
last_updated: "2026-04-12"
---

## Summary

La [[Legione Scarlatta]] ha lanciato un attacco notturno sul [[Porto Vecchio]] di [[Valdris]], incendiando i magazzini e liberando un demone minore dai sotterranei.

## Participants

- [[Thalion Ombraverde]] - ha combattuto al fianco del gruppo
- [[Dito Corto]] - è fuggito durante il caos
- [[Capitano Brennan]] - ha guidato la difesa della guarnigione

## Consequences

- Il quartiere del [[Porto Vecchio]] è stato parzialmente distrutto
- Il portale nei sotterranei è stato destabilizzato
- [[Lord Ashwick]] ha imposto la legge marziale

## Notes

Il gruppo sospetta che l'attacco fosse una copertura per accedere al portale sotterraneo.
```

### Storage Service API

The Electron main process exposes these operations to the renderer via IPC:

```typescript
interface StorageService {
  // Read
  listEntities(entityType: EntityType): Promise<EntitySummary[]>
  getEntity(entityType: EntityType, slug: string): Promise<EntityFile>
  searchEntities(query: string): Promise<EntitySummary[]>

  // Write
  createEntity(entityType: EntityType, content: EntityFile): Promise<void>
  updateEntity(entityType: EntityType, slug: string, content: EntityFile): Promise<void>

  // Matching
  findSimilarEntities(name: string, entityType: EntityType): Promise<MatchCandidate[]>
  entityExists(entityType: EntityType, slug: string): Promise<boolean>

  // Utilities
  resolveWikiLinks(text: string): Promise<ResolvedLink[]>
  generateSlug(name: string, entityType: EntityType): Promise<string>
  getNextEventTimetrack(): Promise<number>
}

type EntityType = 'characters' | 'locations' | 'factions' | 'events'

interface EntitySummary {
  slug: string
  name: string
  type: EntityType
  frontmatter: Record<string, any>
}

interface EntityFile {
  frontmatter: Record<string, any>
  body: string
}

interface MatchCandidate {
  slug: string
  name: string
  aliases: string[]
  score: number        // 0-1, similarity score
  reason: string       // Why this was flagged as a potential match
}
```

### Entity Matching Service

The matcher is a critical component that prevents duplicate entities and helps connect references across sessions. It operates at the storage level (Electron main process).

**Matching strategy (in priority order):**

1. **Exact name match** - entity `name` field matches exactly (case-insensitive)
2. **Alias match** - the searched name matches any entry in the entity's `aliases` array
3. **Partial name match** - the searched name is contained in or contains the entity name (e.g., "Marco" matches "Marco il Grande")
4. **Slug similarity** - Levenshtein distance or similar fuzzy algorithm on slugs

The matcher returns all candidates above a configurable threshold, scored and ranked. When multiple candidates exist, the user is prompted to disambiguate.

---

## Module 2: Distiller

### User Flow

```
┌─────────────────────────────────────────────────────────┐
│  1. INPUT                                               │
│  User pastes session recap text                         │
│  User selects LLM provider + model from dropdown        │
│  User clicks "Extract"                                  │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  2. EXTRACTION                                          │
│  LLM processes the text with separate calls per         │
│  entity type (using provider-specific prompts):         │
│    → Extract characters                                 │
│    → Extract locations                                  │
│    → Extract factions                                   │
│    → Extract events                                     │
│  Each call receives the full text + existing entity     │
│  list for that type (names + slugs + aliases)           │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  3. RECONCILIATION (with fuzzy matching)                │
│  For each extracted entity:                             │
│    → Search storage for exact + fuzzy matches           │
│    → If exact match: prepare UPDATE (specific fields)   │
│    → If fuzzy matches found: present disambiguation     │
│       UI → user picks the right match or "create new"   │
│    → If no match: prepare CREATE with guided form       │
│       to fill in missing details                        │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  4. REVIEW (category-based)                             │
│  UI presents entities grouped by type:                  │
│                                                         │
│  ┌─ Characters ─────────────────────────────────────┐   │
│  │ ✏️  Thalion Ombraverde [UPDATE]                  │   │
│  │    Fields to update: status, key_events          │   │
│  │    [Approve] [Edit] [Skip]                       │   │
│  │                                                  │   │
│  │ ➕ Capitano Brennan [NEW]                        │   │
│  │    Extracted: name, role                         │   │
│  │    Missing: race, class, description             │   │
│  │    [Complete & Create] [Skip]                    │   │
│  │                                                  │   │
│  │ ❓ "Marco" [AMBIGUOUS]                           │   │
│  │    Could be: Marco il Grande, Marco Polo         │   │
│  │    [Pick match] [Create new]                     │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌─ Locations ──────────────────────────────────────┐   │
│  │ ...                                              │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌─ Factions ───────────────────────────────────────┐   │
│  │ ...                                              │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌─ Events ─────────────────────────────────────────┐   │
│  │ ➕ L'Incendio del Porto [NEW] - timetrack: 00003  │   │
│  │    [Complete & Create] [Skip]                    │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  "Save All Approved" button                             │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  5. COMMIT                                              │
│  Save all approved entities to storage                  │
│  Created entities get full .md files                    │
│  Updated entities get only changed fields/sections      │
└─────────────────────────────────────────────────────────┘
```

### Three Entity Flows in Detail

#### Flow A: Entity Already Exists (UPDATE)

When an extracted entity matches an existing one (exact or user-confirmed fuzzy match):

1. Load the current `.md` file from storage
2. Identify **which specific fields/sections** have new information from the recap
3. Present a targeted update - NOT a full replacement:
   - Frontmatter changes: show field-by-field diff (e.g., `status: alive -> dead`)
   - Body changes: show which sections receive new content (appended)
   - Wiki-links: add any new cross-references
4. User approves or edits each individual change
5. Only the approved changes are written to the file

**Important**: updates are surgical. If the recap says "Marco killed a dragon", only the `Key Events` section gets a new entry. Other fields remain untouched.

#### Flow B: Entity is New (CREATE)

When no match is found (or user explicitly chooses "Create new"):

1. Show the user what was extracted from the text
2. Highlight **missing required fields** that the LLM couldn't infer from the recap
3. Present a guided creation form:
   - Pre-filled fields: what the LLM extracted
   - Empty fields: what the user needs to provide (race, class, description, etc.)
   - Auto-generated fields: slug, type, last_updated
4. User completes the form and confirms creation
5. A full `.md` file is generated from the template + user input

**The goal is completeness**: a newly created entity should have all its template sections filled, even if partially. The user is guided to provide what the LLM couldn't extract.

#### Flow C: Ambiguous Match (DISAMBIGUATE)

When the matcher finds fuzzy matches but no exact match:

1. Show the extracted entity name (e.g., "Marco")
2. Show all fuzzy match candidates with their details:
   ```
   ❓ "Marco" - found in recap text
   
   Possible matches:
   ○ Marco il Grande (characters/marco-il-grande.md)
     Race: Umano | Status: alive | Aliases: "Marco", "Il Condottiero"
   ○ Marco Polo (characters/marco-polo.md)
     Race: Umano | Status: missing | Aliases: "L'Esploratore"
   ○ Create as new entity
   ```
3. User picks one option
4. If existing entity picked → proceed to Flow A (UPDATE)
5. If "Create new" picked → proceed to Flow B (CREATE)

### LLM Integration

#### Provider-Specific Prompt System

Prompts are stored as external files in the `prompts/` directory, organized by provider. This allows tuning prompts for each LLM without touching application code.

```
prompts/
├── openai/
│   ├── extract-characters.md
│   ├── extract-locations.md
│   ├── extract-factions.md
│   └── extract-events.md
├── anthropic/
│   ├── extract-characters.md
│   ├── extract-locations.md
│   ├── extract-factions.md
│   └── extract-events.md
└── ollama/
    ├── extract-characters.md
    ├── extract-locations.md
    ├── extract-factions.md
    └── extract-events.md
```

Each prompt file is a Markdown file with YAML frontmatter for prompt metadata:

```markdown
---
provider: openai
entity_type: characters
version: 1
output_format: json
function_name: extract_characters     # For OpenAI function calling
---

You are an entity extractor for a D&D campaign chronicle.

Given the following session recap text and the list of already-known characters,
extract all characters mentioned in the text.

For each character, determine:
1. Whether it matches an existing entity (provide the slug if confident)
2. Whether it might match an existing entity (provide candidates if unsure)
3. Or if it's a new character entirely

For existing characters, extract ONLY the new information from this session.
For new characters, extract all available information.

## Output Schema

{json_schema}

## Known Characters

{known_entities}

## Session Text

{recap_text}
```

**Template variables** (injected at runtime):
- `{json_schema}` - the JSON schema for the expected output
- `{known_entities}` - list of known entities (name, slug, aliases) loaded from storage
- `{recap_text}` - the user's input text

The app reads the prompt file, replaces variables, and sends it to the appropriate API. Different providers may need different prompt structures (e.g., OpenAI uses function calling, Anthropic uses tool_use), and this is handled by the prompt file format + the provider-specific API client.

#### Configuration Files

All LLM configuration lives in `config/llm.json`, editable without rebuilding:

```json
{
  "providers": {
    "openai": {
      "models": [
        {
          "id": "gpt-4o",
          "name": "GPT-4o",
          "maxTokens": 4096,
          "supportsJsonMode": true,
          "supportsFunctionCalling": true
        },
        {
          "id": "gpt-4o-mini",
          "name": "GPT-4o Mini",
          "maxTokens": 4096,
          "supportsJsonMode": true,
          "supportsFunctionCalling": true
        }
      ],
      "defaultModel": "gpt-4o",
      "defaultTemperature": 0.3
    },
    "anthropic": {
      "models": [
        {
          "id": "claude-sonnet-4-20250514",
          "name": "Claude Sonnet 4",
          "maxTokens": 4096,
          "supportsToolUse": true
        },
        {
          "id": "claude-haiku-4-5-20251001",
          "name": "Claude Haiku 4.5",
          "maxTokens": 4096,
          "supportsToolUse": true
        }
      ],
      "defaultModel": "claude-sonnet-4-20250514",
      "defaultTemperature": 0.3
    },
    "ollama": {
      "baseUrl": "http://localhost:11434",
      "models": [
        {
          "id": "llama3.1",
          "name": "Llama 3.1 (8B)",
          "maxTokens": 4096,
          "supportsFunctionCalling": true
        },
        {
          "id": "llama3.1:70b",
          "name": "Llama 3.1 (70B)",
          "maxTokens": 4096,
          "supportsFunctionCalling": true
        },
        {
          "id": "llama3.2",
          "name": "Llama 3.2 (3B)",
          "maxTokens": 4096,
          "supportsFunctionCalling": true
        }
      ],
      "defaultModel": "llama3.1",
      "defaultTemperature": 0.3
    }
  }
}
```

> **Ollama**: nessuna API key richiesta. Il campo `baseUrl` indica l'indirizzo del server Ollama locale (default `http://localhost:11434`). L'app usa l'endpoint OpenAI-compatibile di Ollama (`/v1/chat/completions`) tramite l'SDK OpenAI con chiave fittizia.
```

App-level configuration in `config/app.json`:

```json
{
  "storage": {
    "dataPath": "./data"
  },
  "matching": {
    "fuzzyThreshold": 0.4,
    "maxCandidates": 5
  },
  "ui": {
    "language": "it"
  }
}
```

API keys are **NOT** stored in config files. They are managed separately in Electron's `safeStorage` (encrypted at rest) and entered via the Settings UI.

**Ollama** does not require an API key. The Settings UI shows Ollama in a separate section with a note to ensure the local server is running.

#### Model Selection at Input Time

When the user loads text into the Distiller, the input screen includes:

```
┌─────────────────────────────────────────────┐
│  Provider:  [OpenAI ▾]  Model: [GPT-4o ▾]  │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │                                     │    │
│  │    Paste your session recap here    │    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  [Extract Entities]                         │
└─────────────────────────────────────────────┘
```

- Provider and model dropdowns are populated from `config/llm.json`
- The selected provider determines which prompt files from `prompts/{provider}/` are used
- The selected model is used for all 4 extraction calls for that session
- Last used provider/model is remembered as user preference

#### Extraction Output Schema

```typescript
interface ExtractionResult {
  entity_type: EntityType
  entities: ExtractedEntity[]
}

interface ExtractedEntity {
  name: string
  matched_slug: string | null     // null if LLM thinks it's new
  possible_matches: string[]      // slugs of entities the LLM is unsure about
  confidence: number              // 0-1, how confident the identification is
  extracted_data: {
    frontmatter: Partial<Record<string, any>>
    body_sections: {
      section_name: string        // e.g., "Description", "Key Events"
      content: string             // Markdown content to add/update
      mode: 'append' | 'replace'  // append = add to section; replace = overwrite
    }[]
  }
  reasoning: string               // Why this match/classification was made
}
```

### Update Logic (for existing entities)

When updating an existing entity, only specific properties are modified:

**Frontmatter fields that CAN be updated from a recap:**
- `status` (if the recap explicitly changes it, e.g., character dies)
- `tags` (new tags added, never removed)
- `aliases` (new aliases discovered)
- `last_updated` (always updated)

**Frontmatter fields that are NEVER auto-updated:**
- `name`, `slug`, `type`, `category` - immutable
- `race`, `class` (for characters) - set at creation only
- `base_of_operations` (for factions) - only via manual edit
- `parent_location` (for locations) - only via manual edit

**Body sections - append only:**
- `Key Events` - new events are appended
- `Notes` - new observations are appended
- `Known Members` (factions) - new members added
- `Notable Features` (locations) - new features added

**Body sections - never auto-modified:**
- `Description` - only changed via manual edit
- `Background` / `History` - only changed via manual edit

---

## UI Screens

### 1. Session Input

- Provider/model selector dropdowns (populated from `config/llm.json`)
- Large text area for pasting the session recap
- "Extract" button to start the pipeline
- Loading state showing progress of each extraction call (characters, locations, factions, events - can run in parallel)

### 2. Extraction Review

- Tabbed or accordion layout, one section per entity type
- Three visual states per entity:
  - **[UPDATE]** - existing entity with proposed changes (field-by-field diff)
  - **[NEW]** - new entity with guided creation form for missing fields
  - **[AMBIGUOUS]** - fuzzy match requiring user disambiguation
- Per-entity actions: Approve / Edit / Skip / Disambiguate
- "Save All Approved" bulk action

### 3. Entity Creator (for NEW entities)

- Appears when user clicks "Complete & Create" on a new entity
- Form layout:
  - Pre-filled fields (from LLM extraction) shown with a "extracted" badge
  - Empty required fields highlighted for user input
  - Optional fields available but not required
- Template-based: the form structure matches the entity type's template
- Preview panel showing the `.md` file that will be generated

### 4. Match Resolver (for AMBIGUOUS entities)

- Shows the extracted name prominently
- Lists all match candidates as selectable cards, each showing:
  - Entity name and aliases
  - Key identifying fields (race, location, status, etc.)
  - Similarity score / match reason
- "Create as new entity" option always available
- After selection, proceeds to UPDATE or CREATE flow

### 5. Storage Browser

- Tree view of `data/` directory
- Click any entity to view/edit it
- Search across all entities
- Filter by type, status, tags

### 6. Settings

- LLM provider API key inputs (masked, per provider)
- Storage path display
- Matching sensitivity slider

---

## Key Technical Decisions

### Markdown Parsing

Use `gray-matter` for YAML frontmatter parsing and `remark`/`unified` ecosystem for Markdown AST manipulation. This enables programmatic manipulation of wiki-links and section-based content updates.

### Wiki-Link Resolution

A wiki-link `[[Name]]` resolves by:
1. Exact match on entity `name` field (case-insensitive)
2. Match on any entry in `aliases` array
3. Match on slug

If ambiguous (multiple matches), the user is prompted to disambiguate during review.

### Slug Generation

```
slugify(name) → kebab-case, ASCII-only, max 60 chars
```

For events, prefix with 5-digit zero-padded order number: `00001-name-of-event.md`

### Event Timetracking

Events have a `timetrack` field (integer) that serves as a global chronological tracker across all groups and sessions. The next timetrack number is determined by reading the highest existing value from `data/events/` and incrementing by 1. This is independent of any in-world date system.

### External Configuration

All runtime configuration is stored in editable files under `config/` and `prompts/`:

- `config/llm.json` - provider settings, model lists, default parameters
- `config/app.json` - storage path, matching settings, UI preferences
- `prompts/{provider}/*.md` - extraction prompts per provider per entity type

None of these require rebuilding the app to change. The app reads them at startup and can reload them on demand.

### Error Handling

- LLM API failures: retry with exponential backoff (3 attempts), then show error with option to retry or skip that entity type
- Storage conflicts: if a file was modified externally between load and save, show a warning and let the user resolve
- Malformed markdown: parse gracefully, preserve raw content if frontmatter is invalid
- Missing prompts: if a prompt file is missing for the selected provider, show error and suggest checking the `prompts/` directory

---

## Module 3: World Seeder

### Overview

World Seeder is a Python CLI tool that synchronizes the local entity knowledge base (Markdown files in `data/`) to **World Anvil** via the Boromir API. The local database is the source of truth; World Anvil serves as the publication and visualization platform.

### Architecture

The system uses a **two-pass** approach to handle circular dependencies between entities:

1. **Pass 1**: Create all entities on WA without cross-entity links. Collect the UUIDs assigned by WA.
2. **Pass 2**: PATCH every entity to add resolved references via the mapping table.

**Creation order** (to minimize unresolved dependencies):

| Order | Chronicler Type | WA entityClass   | Dependencies      |
|-------|-----------------|------------------|--------------------|
| 1     | locations       | Location         | None               |
| 2     | factions        | Organization     | Locations          |
| 3     | characters      | Person           | Locations, Factions|
| 4     | events          | HistoricalEvent  | Locations, Characters|

### Components

| Component        | Responsibility                                              |
|------------------|-------------------------------------------------------------|
| `cli.py`         | Click entry point: `seed`, `sync`, `status`, `reset`, `discover`, `verify` |
| `db_reader.py`   | Read `.md` entities from `data/`, parse YAML frontmatter + body |
| `wa_client.py`   | Boromir API wrapper (GET, POST, PATCH, DELETE) with retry   |
| `mapper.py`      | Convert Chronicler entity to WA article JSON payload        |
| `bbcode.py`      | Markdown to BBCode conversion (headers, bold, lists, links) |
| `sync_engine.py` | Two-pass orchestration, error handling, rate limiting        |
| `mapping_store.py`| SQLite persistence for the `wa_sync` mapping table          |

### API Authentication

Every request requires two headers:

- `x-application-key`: Application key (requires WA Grandmaster plan)
- `x-auth-token`: User auth token (requires WA Master+ plan)

Keys are stored in a `.env` file (excluded from VCS) and loaded via `python-dotenv`.

### Entity Mapping

#### Character to Person

| Chronicler field       | WA field              | Notes                        |
|------------------------|-----------------------|------------------------------|
| `name`                 | `title`               | Also split into firstname/lastname |
| `aliases[0]`           | `nickname`            |                              |
| `frontmatter.race`     | `species`             | UUID link if species exists  |
| `frontmatter.status`   | `deathDate`           | null if alive                |
| `body ## Description`  | `content` (BBCode)    | Main article body            |
| `body ## Background`   | `history` (BBCode)    |                              |
| `body ## Notable Items`| `personalPossessions` (BBCode) |                       |
| wiki-links to locations| `currentLocation`     | UUID via mapping table       |

#### Location to Location

| Chronicler field           | WA field           | Notes                  |
|----------------------------|--------------------|------------------------|
| `name`                     | `title`            |                        |
| `category`                 | `locationType`     | city, dungeon, etc.    |
| `parent_location`          | `parentLocation`   | UUID via mapping table |
| `body ## Description`      | `content` (BBCode) |                        |
| `body ## History`          | `history` (BBCode) |                        |
| `body ## Notable Features` | `pointsOfInterest` (BBCode) |               |

#### Faction to Organization

| Chronicler field          | WA field          | Notes                  |
|---------------------------|-------------------|------------------------|
| `name`                    | `title`           |                        |
| `base_of_operations`      | `headquarters`    | UUID via mapping table |
| `body ## Description`     | `content` (BBCode)|                        |
| `body ## Known Members`   | `members` (BBCode)|                        |
| `body ## Goals`           | `goals` (BBCode)  |                        |

#### Event to HistoricalEvent

| Chronicler field          | WA field          | Notes                  |
|---------------------------|-------------------|------------------------|
| `name`                    | `title`           |                        |
| `frontmatter.location`   | `location`        | UUID via mapping table |
| `frontmatter.date_in_world`| `startDate`     |                        |
| `body ## Summary`         | `content` (BBCode)|                        |
| `body ## Participants`    | `participants` (BBCode) |                  |
| `body ## Consequences`    | `result` (BBCode) |                        |

### Mapping Table

Stored in a local SQLite database (`wa_sync.db`):

```sql
CREATE TABLE wa_sync (
    db_id        TEXT    PRIMARY KEY,   -- entity slug
    entity_type  TEXT    NOT NULL,      -- 'characters' | 'locations' | 'factions' | 'events'
    wa_uuid      TEXT    UNIQUE,        -- UUID assigned by World Anvil
    wa_url       TEXT,                  -- article URL on WA
    synced_at    TIMESTAMP,            -- last successful sync
    dirty        BOOLEAN DEFAULT FALSE, -- TRUE = needs re-sync
    error        TEXT                   -- last error message
);
```

**Record lifecycle**:

| State         | dirty | wa_uuid | Description                        |
|---------------|-------|---------|-------------------------------------|
| New           | TRUE  | NULL    | Entity in DB, not yet on WA        |
| Synced        | FALSE | present | Aligned between DB and WA          |
| Modified      | TRUE  | present | DB updated, PATCH pending          |
| Error         | TRUE  | any     | Last attempt failed, retry pending |

### Conversions

**Markdown to BBCode**: The `bbcode.py` module handles conversion of Markdown body content to World Anvil's BBCode format:

- `## Header` to `[h2]Header[/h2]`
- `**bold**` to `[b]bold[/b]`
- `*italic*` to `[i]italic[/i]`
- `- list item` to `[ul][li]list item[/li][/ul]`
- `[[Entity Name]]` to `[article:UUID]` (resolved via mapping table)

### CLI Commands

| Command                        | Description                                     |
|--------------------------------|-------------------------------------------------|
| `world-seeder seed`            | Full initial sync (two-pass)                    |
| `world-seeder sync`            | Incremental sync (dirty entities only)          |
| `world-seeder status`          | Report: synced, pending, errored entity counts  |
| `world-seeder reset [--type T]`| Mark all (or one type) as dirty for re-sync     |
| `world-seeder discover <uuid>` | GET granularity=2 on a WA article, print fields |
| `world-seeder verify`          | Compare local DB vs WA and report divergences   |

### Configuration

Environment variables (`.env`):

```
WA_APPLICATION_KEY=xxx
WA_AUTH_TOKEN=yyy
WA_WORLD_ID=uuid-del-mondo
SEEDER_DB_URL=sqlite:///wa_sync.db
WA_RATE_LIMIT_DELAY=0.5
WA_DRY_RUN=false
```

The tool also reads `config/app.json` to determine the `storage.dataPath` for entity file locations.

### Error Handling

| Error Type           | Behavior                                          |
|----------------------|---------------------------------------------------|
| 429 Rate Limit       | Exponential backoff with jitter, max 5 retries    |
| 403 Cloudflare block | Retry with User-Agent + 30s delay                 |
| 404 Not Found        | Reset wa_uuid, recreate on next run               |
| 5xx Server Error     | Retry with backoff, max 3 attempts, then skip     |
| Network error        | Immediate retry 1x, then skip with log            |
| Mapping error        | Critical log, skip entity, continue with others   |

### Tech Stack

| Component   | Choice          | Rationale                           |
|-------------|-----------------|-------------------------------------|
| Language    | Python 3.11+    | Rich ecosystem, pywaclient available|
| HTTP client | httpx (async)   | Native async/await and retry        |
| WA API      | pywaclient      | Boromir wrapper with intellisense   |
| DB          | SQLite          | Zero-config, local-only             |
| ORM         | SQLAlchemy      | DB abstraction                      |
| Config      | python-dotenv   | No keys in source code              |
| CLI         | Click           | Intuitive commands                  |
| Logging     | loguru          | Structured logging with file rotation|
| Test        | pytest + pytest-httpx | API call mocking              |

### Roadmap

| Phase | Milestone       | Content                                              |
|-------|-----------------|------------------------------------------------------|
| v0.1  | Bootstrap       | Repo setup, CLI base, wa_client, mapping table       |
| v0.2  | Seed Location   | Full mapping + sync for Locations                    |
| v0.3  | Seed Character  | Mapping + sync for Characters with Location links    |
| v0.4  | Seed Event      | Mapping + sync for Events with Location + Character links |
| v0.5  | Incremental     | Dirty flag, retry logic, error reporting             |
| v1.0  | Release         | Full CLI, test coverage, README, .env.example        |

---

## Out of Scope (Future)

- **Viewer module**: HTML visualization of the knowledge base (Obsidian serves as interim viewer)
- **Timeline**: chronological visualization of events using the `timetrack` field
- **Relationship graph**: visual map of entity connections via wiki-links
- **Multi-user**: collaboration features, conflict resolution
- **Export**: PDF generation, wiki export
- **World map integration**: linking locations to map coordinates
- **Automated session recording**: voice-to-text pipeline
- **Session tracking**: tracking play dates, DMs, players, group metadata
- **Bidirectional WA sync**: importing from World Anvil back to local DB (WA is publish-only)
