# CLAUDE.md  - Chronicler

## Project Overview

Chronicler is a system for tracking D&D campaign entities across multiple groups in a shared world. It uses LLM APIs (OpenAI/Anthropic/Ollama, configurable) to extract structured entities from unstructured session recaps, and stores them as Obsidian-compatible Markdown files.

The project has three modules: **Distiller** (Electron + React app), **Storage** (filesystem `.md` files), and **Viewer** (TBD).

## Key Architecture Decisions

- **Two separate apps**: Distiller (Electron + React) and Viewer (TBD) under `distiller/` and `viewer/`
- **Electron main process** handles: filesystem I/O on `data/` directory, LLM API calls, config management, entity matching
- **React renderer** handles: UI, extraction review workflow, entity editing, disambiguation
- **IPC bridge** connects renderer to main process services (storage, llm, matcher)
- **Storage is pure Markdown**: YAML frontmatter + `[[wiki-links]]`, no database
- **One LLM call per entity type** (characters, locations, factions, events)  - not one monolithic call
- **LLM outputs structured JSON** via function calling / tool_use  - parsed and converted to .md by the app
- **Prompts are external files** in `prompts/{provider}/`  - editable without rebuild, provider-specific
- **All config is external** in `config/`  - editable without rebuild
- **Ollama support**: local inference via Ollama, no API key needed. Uses OpenAI-compatible API (`/v1`). `baseUrl` configurable in `config/llm.json` (default `http://localhost:11434`)

## Entity Types

- `characters/`  - PCs and NPCs (items are properties of characters, not separate entities)
- `locations/`  - cities, dungeons, regions, landmarks
- `factions/`  - organizations, guilds, political groups
- `events/`  - notable in-game occurrences, sequenced by 5-digit `timetrack` field (00001, 00002, ...)

No session tracking  - sessions are not stored as entities.

## File Format

All `.md` files use YAML frontmatter with standard fields per entity type (see SPEC.md for full schemas). Cross-references use `[[wiki-links]]` compatible with Obsidian.

## Important Patterns

- Slug generation: kebab-case, ASCII-only. Events prefixed with 5-digit zero-padded order (e.g., `00003-incendio-del-porto.md`)
- Entity matching: fuzzy matching service searches by name, aliases, partial match, slug similarity
- Updates are surgical: only specific fields/sections are modified, never full replacement
- New entity creation is guided: user completes missing fields via form
- Ambiguous matches prompt user disambiguation before any action
- User reviews all changes before any write to disk (category-based review UI)
- Model selection happens at input time (per extraction session)

## Libraries

- `gray-matter` for YAML frontmatter parsing
- `remark` / `unified` for Markdown AST manipulation
- `electron-vite` or similar for Electron + Vite integration
- Electron `safeStorage` for API key encryption

## Commands

```bash
cd distiller
npm install          # Install dependencies
npm run dev          # Start Electron app in dev mode
npm run build        # Build for production
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript type checking
```
