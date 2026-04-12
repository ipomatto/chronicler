import fs from 'node:fs/promises'
import path from 'node:path'
import { parseMarkdown, serializeMarkdown, buildSlug } from '../../src/lib/markdown'
import type { EntityType, EntitySummary, EntityFile, MatchCandidate, ResolvedLink, UnlinkedMatch } from '../../src/types/entities'

export class StorageService {
  constructor(private readonly dataPath: string) {}

  private dirFor(entityType: EntityType): string {
    return path.join(this.dataPath, entityType)
  }

  private filePath(entityType: EntityType, slug: string): string {
    return path.join(this.dirFor(entityType), `${slug}.md`)
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async listEntities(entityType: EntityType): Promise<EntitySummary[]> {
    const dir = this.dirFor(entityType)
    let entries: string[]
    try {
      entries = await fs.readdir(dir)
    } catch {
      return []
    }
    const summaries: EntitySummary[] = []
    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue
      const slug = entry.replace(/\.md$/, '')
      try {
        const raw = await fs.readFile(path.join(dir, entry), 'utf-8')
        const { frontmatter } = parseMarkdown(raw)
        summaries.push({
          slug,
          name: String(frontmatter.name ?? slug),
          type: entityType,
          frontmatter
        })
      } catch {
        // skip malformed files
      }
    }
    return summaries
  }

  async getEntity(entityType: EntityType, slug: string): Promise<EntityFile> {
    const raw = await fs.readFile(this.filePath(entityType, slug), 'utf-8')
    return parseMarkdown(raw)
  }

  async searchEntities(query: string): Promise<EntitySummary[]> {
    const allTypes: EntityType[] = ['characters', 'locations', 'factions', 'events']
    const results: EntitySummary[] = []
    const lower = query.toLowerCase()
    for (const entityType of allTypes) {
      const entities = await this.listEntities(entityType)
      for (const e of entities) {
        if (
          e.name.toLowerCase().includes(lower) ||
          e.slug.includes(lower) ||
          (Array.isArray(e.frontmatter.aliases) &&
            (e.frontmatter.aliases as string[]).some((a) => a.toLowerCase().includes(lower)))
        ) {
          results.push(e)
        }
      }
    }
    return results
  }

  // ---------------------------------------------------------------------------
  // Write
  // ---------------------------------------------------------------------------

  async createEntity(entityType: EntityType, content: EntityFile): Promise<void> {
    const slug = String(content.frontmatter.slug)
    if (!slug) throw new Error('Entity must have a slug in frontmatter')
    const dir = this.dirFor(entityType)
    await fs.mkdir(dir, { recursive: true })
    const filePath = this.filePath(entityType, slug)
    const raw = serializeMarkdown(content)
    await fs.writeFile(filePath, raw, 'utf-8')
    void this.rebuildIndex()
  }

  async updateEntity(entityType: EntityType, slug: string, content: EntityFile): Promise<void> {
    const filePath = this.filePath(entityType, slug)
    // Verify file exists before overwriting
    await fs.access(filePath)
    const raw = serializeMarkdown(content)
    await fs.writeFile(filePath, raw, 'utf-8')
    void this.rebuildIndex()
  }

  // ---------------------------------------------------------------------------
  // Matching helpers
  // ---------------------------------------------------------------------------

  async entityExists(entityType: EntityType, slug: string): Promise<boolean> {
    try {
      await fs.access(this.filePath(entityType, slug))
      return true
    } catch {
      return false
    }
  }

  async findSimilarEntities(name: string, entityType: EntityType): Promise<MatchCandidate[]> {
    // Delegated to MatcherService – StorageService exposes raw data for it
    const entities = await this.listEntities(entityType)
    return entities
      .map((e) => ({
        slug: e.slug,
        name: e.name,
        aliases: (e.frontmatter.aliases as string[] | undefined) ?? [],
        score: 0,
        reason: ''
      }))
      .filter((e) => e.name !== '')
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  async generateSlug(name: string, entityType: EntityType): Promise<string> {
    const base = buildSlug(name, entityType)
    if (!(await this.entityExists(entityType, base))) return base
    // Append numeric suffix until unique
    let i = 2
    while (await this.entityExists(entityType, `${base}-${i}`)) i++
    return `${base}-${i}`
  }

  async getNextEventTimetrack(): Promise<number> {
    const events = await this.listEntities('events')
    if (events.length === 0) return 1
    const max = events.reduce((m, e) => {
      const t = Number(e.frontmatter.timetrack ?? 0)
      return t > m ? t : m
    }, 0)
    return max + 1
  }

  async rebuildIndex(): Promise<void> {
    const allTypes: EntityType[] = ['characters', 'locations', 'factions', 'events']
    const labels: Record<EntityType, string> = {
      characters: 'Personaggi',
      locations: 'Luoghi',
      factions: 'Fazioni',
      events: 'Eventi'
    }

    const lines: string[] = [
      '# Chronicler — Indice Entità',
      '',
      `_Aggiornato: ${new Date().toISOString().slice(0, 10)}_`,
      ''
    ]

    for (const type of allTypes) {
      try {
        const entities = await this.listEntities(type)
        if (entities.length === 0) continue
        lines.push(`## ${labels[type]}`, '')
        lines.push('| Nome | Slug | Aliases |')
        lines.push('|------|------|---------|')
        for (const e of entities) {
          const aliases = (e.frontmatter.aliases as string[] | undefined) ?? []
          lines.push(`| ${e.name} | ${e.slug} | ${aliases.join(', ')} |`)
        }
        lines.push('')
      } catch {
        // skip types that fail
      }
    }

    try {
      await fs.mkdir(this.dataPath, { recursive: true })
      await fs.writeFile(path.join(this.dataPath, 'index.md'), lines.join('\n'), 'utf-8')
    } catch {
      // index is a convenience feature — don't fail writes if it can't be created
    }
  }

  async findUnlinkedOccurrences(body: string): Promise<UnlinkedMatch[]> {
    const allTypes: EntityType[] = ['characters', 'locations', 'factions', 'events']
    const results: UnlinkedMatch[] = []

    // Pre-compute already-linked spans so we skip them
    // Split body into [non-link, link, non-link, link, ...] segments
    const countInNonLinkedSegments = (text: string, pattern: RegExp): number => {
      const parts = text.split(/(\[\[[^\]]*\]\])/g)
      let total = 0
      for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 1) continue // skip [[existing links]]
        const m = parts[i].match(pattern)
        if (m) total += m.length
      }
      return total
    }

    for (const entityType of allTypes) {
      const entities = await this.listEntities(entityType)
      for (const entity of entities) {
        const namesToCheck = [
          entity.name,
          ...((entity.frontmatter.aliases as string[] | undefined) ?? [])
        ].filter(Boolean)

        let count = 0
        for (const name of namesToCheck) {
          const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const regex = new RegExp(escaped, 'gi')
          count += countInNonLinkedSegments(body, regex)
        }

        if (count > 0) {
          results.push({ entityName: entity.name, entityType, entitySlug: entity.slug, count })
        }
      }
    }

    // Sort by count descending
    results.sort((a, b) => b.count - a.count)
    return results
  }

  async resolveWikiLinks(text: string): Promise<ResolvedLink[]> {
    const pattern = /\[\[([^\]]+)\]\]/g
    const matches = [...text.matchAll(pattern)]
    const allTypes: EntityType[] = ['characters', 'locations', 'factions', 'events']

    const results: ResolvedLink[] = []
    for (const match of matches) {
      const linkText = match[1].trim()
      const found: { slug: string; entityType: EntityType }[] = []

      for (const entityType of allTypes) {
        const entities = await this.listEntities(entityType)
        for (const e of entities) {
          const aliases = (e.frontmatter.aliases as string[] | undefined) ?? []
          const names = [e.name, e.slug, ...aliases]
          if (names.some((n) => n.toLowerCase() === linkText.toLowerCase())) {
            found.push({ slug: e.slug, entityType })
          }
        }
      }

      if (found.length === 1) {
        results.push({ text: linkText, slug: found[0].slug, entityType: found[0].entityType, ambiguous: false })
      } else if (found.length > 1) {
        results.push({ text: linkText, slug: null, entityType: null, ambiguous: true })
      } else {
        results.push({ text: linkText, slug: null, entityType: null, ambiguous: false })
      }
    }
    return results
  }
}
