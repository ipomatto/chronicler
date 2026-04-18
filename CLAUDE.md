# CLAUDE.md  - Chronicler

## Project Overview

Chronicler is a system for tracking D&D campaign entities across multiple groups in a shared world. It uses LLM APIs (OpenAI/Anthropic/Ollama, configurable) to extract structured entities from unstructured session recaps, and stores them as Obsidian-compatible Markdown files.

The project has four modules: **Distiller** (Electron + React app for LLM entity extraction), **Storage** (filesystem `.md` files), **World Seeder** (Electron + React app for World Anvil sync via Boromir API), and **Viewer** (TBD).

## Key Architecture Decisions

- **Three separate apps**: Distiller, World Seeder, and Viewer (TBD) under `distiller/`, `world-seeder/`, and `viewer/` — all Electron + React, same stack
- **World Seeder** syncs the local entity DB to World Anvil via a two-pass pipeline (POST without links, then PATCH with resolved UUIDs), with a SQLite mapping table (`data/wa-sync.db`). See [`world-seeder/SPEC.md`](./world-seeder/SPEC.md).
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

## Git Workflow (for AI contributors)

See [CONTRIBUTING.md](./CONTRIBUTING.md) for full rules. Core constraints when proposing changes:

1. **Never commit or push directly to `main` or `devel`.** Both are protected by a ruleset that blocks direct pushes.
2. **Start from `devel`.** Exception: if the user references an issue that has a `feature/<name>` label, branch from that feature branch instead.
3. **Branch naming**:
   - Short-lived work: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`, `chore/<slug>`
   - Inside a `feature/*` long-lived branch, prefix the slug with the feature name (e.g. `feat/viewer-toc`)
4. **Long-lived feature branches** currently in use: `feature/viewer`, `feature/llama-integration`, `feature/world-seeder`. Do **not** create new `feature/*` branches without explicit user instruction.
5. **PR target**:
   - Issue labelled `feature/<name>` → PR targets `feature/<name>`
   - Otherwise → PR targets `devel`
   - **Never** open PRs toward `main`. Release PRs (`devel` → `main`) are maintainer-only.
6. **Commit messages**: Conventional Commits style (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`). Not enforced by hooks but matches the repo history.
7. **Do not bump `distiller/package.json` version** unless the user explicitly asks for a release. Version bumps are the maintainer's decision.
8. **Do not create git tags** or push to `main`. The `release.yml` workflow handles tagging automatically on release PR merge.
