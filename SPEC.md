# Chronicler - Project Specification

## Overview

Chronicler is a system for tracking and organizing narrative content from multiple D&D campaign sessions in a shared fantasy world. It ingests unstructured session recaps, extracts structured entities (characters, locations, factions, events) via LLM, and maintains a persistent knowledge base as Obsidian-compatible Markdown files.

The system is composed of four modules:

- **Distiller**: Electron + React app that processes session text via LLM, extracts entities, and manages the knowledge base. See [`distiller/SPEC.md`](distiller/SPEC.md) for full details.
- **Storage**: Filesystem-based structured archive of `.md` files with YAML frontmatter and `[[wiki-links]]`
- **World Seeder**: Electron + React app that synchronizes the local entity database to World Anvil via the Boromir API. See [`world-seeder/SPEC.md`](world-seeder/SPEC.md) for full details.
- **Viewer** (TBD): HTML-based visualization of the knowledge base - deferred to a future phase

---

## Project Structure

```
chronicler/
├── distiller/                     # Electron + React — LLM entity extraction
├── world-seeder/                  # Electron + React — World Anvil sync
├── viewer/                        # TBD
├── storage/
│   └── templates/                 # Reference templates per entity type
│       ├── character.md
│       ├── location.md
│       ├── faction.md
│       └── event.md
├── data/                          # Knowledge base (Obsidian-compatible vault)
│   ├── characters/
│   ├── locations/
│   ├── factions/
│   └── events/
├── prompts/                       # LLM extraction prompts (per provider)
│   ├── openai/
│   ├── anthropic/
│   └── ollama/
├── config/
│   ├── app.json                   # Shared app settings
│   └── llm.json                   # LLM provider/model config
├── SPEC.md                        # This file (architecture overview)
├── CLAUDE.md
└── README.md
```

---

## Storage

### Principles

- Every entity is a single `.md` file in `data/{type}/`
- Files use YAML frontmatter for structured metadata + Markdown body with `[[wiki-links]]`
- Fully compatible with Obsidian (can be opened as a vault)
- File names are kebab-case slugs (ASCII-only) derived from the entity name
- Slugs must be unique within their entity type folder
- Events use 5-digit zero-padded `timetrack` prefix (e.g., `00003-incendio-del-porto.md`)

### Entity Types

| Type | Folder | Frontmatter key fields | Body sections |
|------|--------|------------------------|---------------|
| Character | `data/characters/` | `category` (pc/npc), `status`, `race`, `class`, `aliases` | Description, Background, Notable Items, Key Events, Notes |
| Location | `data/locations/` | `category` (city/dungeon/...), `status`, `parent_location` | Description, Notable Features, History, Key Events, Notes |
| Faction | `data/factions/` | `category` (political/criminal/...), `status`, `base_of_operations` | Description, Known Members, Goals, Relations, Key Events, Notes |
| Event | `data/events/` | `timetrack`, `category`, `date_in_world`, `location` | Summary, Participants, Consequences, Notes |

All types share: `name`, `slug`, `type`, `tags[]`, `last_updated`, `sessione` (UUID).

Full frontmatter schemas and body section details are in [`distiller/SPEC.md`](distiller/SPEC.md).

### Wiki-Link Resolution

A `[[Name]]` link resolves by: exact name match (case-insensitive) > alias match > slug match. Ambiguous matches prompt user disambiguation.

### Slug Generation

`slugify(name)` produces kebab-case, ASCII-only, max 60 chars. Events prefix with zero-padded timetrack.

---

## Shared Configuration

### `config/app.json`

```json
{
  "storage": { "dataPath": "./data" },
  "matching": { "fuzzyThreshold": 0.4, "maxCandidates": 5 },
  "ui": { "language": "it", "devtools": false },
  "fingerprintThreshold": 10
}
```

### `config/llm.json`

Defines providers (openai, anthropic, ollama), their available models, default model/temperature, and Ollama baseUrl. Editable without rebuild. See [`distiller/SPEC.md`](distiller/SPEC.md) for structure.

### API Key Storage

All API keys (LLM providers, World Anvil) are encrypted via Electron's `safeStorage` — never stored in config files or environment variables.

---

## Module Overview

### Distiller

Processes session recap text through LLM to extract structured entities. Four parallel LLM calls (one per entity type) with provider-specific prompts. Includes fuzzy matching, disambiguation, guided entity creation, and SimHash-based duplicate session detection.

Full specification: [`distiller/SPEC.md`](distiller/SPEC.md)

### World Seeder

Synchronizes the local entity database to World Anvil via the Boromir API. Uses a two-pass approach (create without links, then patch with resolved references) and maintains a SQLite mapping table for slug-to-UUID resolution. Includes a GUI for configuration, sync monitoring, and error management.

Full specification: [`world-seeder/SPEC.md`](world-seeder/SPEC.md)

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
