# Viewer

Placeholder for a future HTML-based visualization of the Chronicler knowledge base.

`index.html` is now a first-pass static viewer for the contents of `../data/`.
It provides:
- tabs for `characters`, `locations`, `factions`, and `events`
- an index tab
- a glossary tab
- linked related content from tags and `[[wiki-links]]`
- a search bar with suggestions starting from the third character

Planned features:
- Timeline visualization using the `timetrack` field
- Relationship graph from `[[wiki-links]]`
- Filterable entity browser

In the meantime, the `data/` vault is fully compatible with **Obsidian** and can be opened directly as a vault.

To use the HTML viewer reliably, serve the `chronicler/` folder with a small local web server rather than opening `index.html` via `file://`, because the viewer loads markdown files through `fetch()`.

Quick start:
- from `chronicler/`, run `npm run start-viewer`
- then open `http://localhost:8000/viewer/index.html`
