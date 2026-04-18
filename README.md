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

Lavoriamo in [GitHub flow](https://docs.github.com/en/get-started/using-github/github-flow): `main` è sempre deployabile, ogni modifica vive su un branch dedicato e arriva in `main` via Pull Request con CI verde.

Convenzione di naming dei branch (in linea con lo storico):

- `feat/<slug>` — nuove funzionalità
- `fix/<slug>` — bug fix
- `docs/<slug>` — modifiche alla documentazione
- `chore/<slug>` — manutenzione, build, CI

## License

Distribuito sotto [Apache License 2.0](./LICENSE).
