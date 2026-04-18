# Contributing to Chronicler

## Branching model

Il repo usa un flusso a **tre livelli**:

- **`main`** (default branch) — branch di release, sempre deployabile. Protetto: accetta solo release PR aperte dal maintainer (`devel` → `main`) con il bump di versione.
- **`devel`** — branch di integrazione. Accoglie feature e fix completati prima che confluiscano in `main`. Protetto: ogni modifica arriva via PR con CI verde.
- **`feature/<nome>`** — branch long-lived per feature coordinate e corpose. Attualmente in uso:
  - `feature/viewer` — modulo Viewer
  - `feature/llama-integration` — supporto al modello Llama
  - `feature/world-seeder` — modulo World Seeder

Entrambi `main` e `devel` sono coperti dallo stesso ruleset (PR obbligatoria, CI verde, no push diretti, no force push).

## Dove va il tuo lavoro?

Le issue sono classificate con **label**. Il label `feature/*` determina il branch target della PR:

| Label sulla issue | Branch target della PR |
|---|---|
| `feature/viewer` | `feature/viewer` |
| `feature/llama-integration` | `feature/llama-integration` |
| `feature/world-seeder` | `feature/world-seeder` |
| `bug` (senza `feature/*`) | `devel` |
| Nessun label `feature/*` | `devel` |

Se una issue ha sia `bug` che `feature/viewer`, il label `feature/*` **vince** per scegliere il target: il fix va sul branch della feature, non su `devel`.

Solo il maintainer assegna le label `feature/*`.

## Workflow

### Lavoro short-lived (target `devel`)

Per bug fix, piccole feature, docs, chore che non appartengono a un feature long-lived:

```bash
git switch devel && git pull
git switch -c <type>/<slug>    # feat/, fix/, docs/, chore/
# ...lavora, commit, push...
gh pr create --base devel
```

Una volta mergiata la PR, il branch viene auto-eliminato.

### Lavoro su un feature long-lived (target `feature/<nome>`)

Ogni PR chiude **una** issue per volta dentro il feature:

```bash
git switch feature/viewer && git pull
git switch -c feat/viewer-<slug>
# ...lavora, commit, push...
gh pr create --base feature/viewer
```

Nella descrizione usa `Closes #N` per auto-chiudere l'issue associata al merge.

Quando la feature è completa, il maintainer apre la PR `feature/<nome>` → `devel`.

## Branch naming

| Prefisso | Uso | Esempio |
|---|---|---|
| `feat/` | Nuova feature short-lived | `feat/dark-mode` |
| `fix/` | Bug fix | `fix/token-count-off-by-one` |
| `docs/` | Documentazione | `docs/readme-screenshots` |
| `chore/` | Manutenzione, build, CI | `chore/bump-electron` |
| `feature/` | **Feature long-lived** (solo quelle in elenco sopra) | `feature/viewer` |

Per un branch di lavoro dentro un feature long-lived, includi il nome del feature nello slug: `feat/viewer-header-bar`.

## Commit messages

Stile **Conventional Commits** — non forzato da hook ma coerente con lo storico del repo:

```
feat: add dark mode toggle
fix: handle empty entity list
docs: update release process
chore: bump electron to 34
refactor: extract slug utility
test: cover fuzzy matcher edge cases
```

Titolo imperativo, conciso, max 72 caratteri. Corpo opzionale per spiegare il *perché*.

## Issue labels

Le label in uso sono volutamente **minime**:

- `bug` — segnalazione di malfunzionamento
- `feature/viewer` · `feature/llama-integration` · `feature/world-seeder` — classificano l'issue come appartenente a una feature long-lived e definiscono il branch target della PR

Le label di default di GitHub (`duplicate`, `enhancement`, `good first issue`, `help wanted`, `invalid`, `question`, `wontfix`, `documentation`) **non sono in uso**.

## Pull request checklist

- CI verde (obbligatorio, bloccante)
- Target branch corretto (verifica la prima sezione del PR template)
- Titolo in stile Conventional Commits
- Descrizione compila il PR template
- `Closes #N` / `Refs #N` nella descrizione per collegare l'issue

## Release process

Solo il maintainer apre release PR. Le release sono **Windows-only** e riguardano per ora solo il modulo `distiller`.

Il maintainer sceglie manualmente il numero di versione secondo [semver](https://semver.org): `patch` per bugfix, `minor` per nuove feature backward-compatible, `major` per breaking change.

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
