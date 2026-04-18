# Chronicler

A desktop application for tracking D&D campaign narratives across multiple groups in a shared fantasy world.

Chronicler ingests unstructured session recaps, extracts structured entities (characters, locations, factions, events) via LLM, and maintains a persistent knowledge base as Obsidian-compatible Markdown files.

## How It Works

1. **Paste** your session recap into the Distiller app
2. **Select** the LLM provider and model to use
3. **Extract**  - the LLM identifies characters, locations, factions, and events
4. **Review**  - approve, edit, or skip each entity (grouped by category), with fuzzy matching to detect existing entities and guided forms for new ones
5. **Save**  - entities are written to structured `.md` files in `data/`

Existing entities are updated surgically (only changed fields). New entities are created with user-guided completion of missing details. The `data/` folder is an Obsidian-compatible vault with `[[wiki-links]]` between entities.

## Modules

| Module       | Status   | Description                                      |
| ------------ | -------- | ------------------------------------------------ |
| **Distiller** | Active   | Electron + React app for entity extraction        |
| **Storage**   | Active   | Filesystem-based `.md` archive                    |
| **Viewer**    | TBD      | HTML visualization (Obsidian serves as interim)   |

## Tech Stack

- **Electron**  - desktop shell with filesystem access
- **Vite + React + TypeScript**  - frontend
- **OpenAI / Anthropic API**  - configurable LLM for entity extraction
- **Markdown + YAML frontmatter**  - storage format (Obsidian-compatible)

## Project Structure

```
chronicler/
├── distiller/         # Electron + React app
├── viewer/            # TBD  - placeholder
├── storage/           # Shared schemas and templates
├── data/              # Knowledge base (Obsidian vault)
│   ├── characters/
│   ├── locations/
│   ├── factions/
│   └── events/
├── prompts/           # LLM extraction prompts (editable without rebuild)
│   ├── openai/
│   └── anthropic/
├── config/            # Runtime configuration (editable without rebuild)
└── SPEC.md            # Full project specification
```

## Getting Started

```bash
cd distiller
npm install
npm run dev
```

## Configuration

LLM settings and app configuration live in `config/` as JSON files. Extraction prompts live in `prompts/` as Markdown files. Both can be modified without rebuilding the app. API keys are managed securely via Electron's `safeStorage`.

## Documentation

See [SPEC.md](./SPEC.md) for the full project specification.

## Contributing

Il repo usa un flusso a due branch:

- **`devel`** (default) — branch di integrazione. Tutte le feature/fix atterrano qui via Pull Request con CI verde.
- **`main`** — branch di release. Solo il maintainer apre una *release PR* da `devel` a `main`; il merge fa partire automaticamente build e pubblicazione.

Convenzione di naming dei branch di lavoro (in linea con lo storico):

- `feat/<slug>` — nuove funzionalità
- `fix/<slug>` — bug fix
- `docs/<slug>` — modifiche alla documentazione
- `chore/<slug>` — manutenzione, build, CI

## Release process

Le release sono **Windows-only** e riguardano per ora solo il modulo `distiller`. Il maintainer sceglie manualmente il numero di versione secondo [semver](https://semver.org): `patch` per bugfix, `minor` per nuove feature backward-compatible, `major` per breaking change.

Procedura:

1. `git switch devel && git pull`
2. Aprire `distiller/package.json` in un editor e modificare il campo `"version"` (es. `"0.1.0"` → `"0.2.0"`)
3. `git commit -am "chore: release X.Y.Z"`
4. `git push`
5. Aprire una PR da `devel` a `main` e mergiarla (squash)
6. Il workflow `release.yml` parte automaticamente: builda l'installer NSIS, crea il tag `vX.Y.Z` e pubblica una **Release draft** su GitHub con l'`.exe` allegato e le note auto-generate dalle PR
7. Rivedere le note sulla Release draft e pubblicarla manualmente
8. Risincronizzare `devel`: `git switch devel && git merge main && git push`

Se dimentichi di bumpare la versione, `release.yml` abortisce senza creare duplicati (il tag esistente viene rilevato).

## License

Distribuito sotto [Apache License 2.0](./LICENSE).
