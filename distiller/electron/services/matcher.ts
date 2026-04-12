import Fuse from 'fuse.js'
import type { EntityType, EntitySummary, MatchCandidate } from '../../src/types/entities'
import type { StorageService } from './storage'

export class MatcherService {
  constructor(
    private readonly storage: StorageService,
    private readonly fuzzyThreshold: number = 0.4,
    private readonly maxCandidates: number = 5
  ) {}

  async findSimilarEntities(name: string, entityType: EntityType): Promise<MatchCandidate[]> {
    const entities = await this.storage.listEntities(entityType)
    const candidates: MatchCandidate[] = []

    const nameLower = name.toLowerCase()

    for (const entity of entities) {
      const aliases = (entity.frontmatter.aliases as string[] | undefined) ?? []
      const candidate = this.scoreEntity(entity, aliases, name, nameLower)
      if (candidate) candidates.push(candidate)
    }

    if (candidates.length > 0) {
      return candidates
        .sort((a, b) => b.score - a.score)
        .slice(0, this.maxCandidates)
    }

    // Fall back to Fuse.js fuzzy search if no rule-based matches
    return this.fuzzySearch(name, entities)
  }

  private scoreEntity(
    entity: EntitySummary,
    aliases: string[],
    name: string,
    nameLower: string
  ): MatchCandidate | null {
    const entityNameLower = entity.name.toLowerCase()

    // 1. Exact name match
    if (entityNameLower === nameLower) {
      return {
        slug: entity.slug,
        name: entity.name,
        aliases,
        score: 1.0,
        reason: 'Exact name match'
      }
    }

    // 2. Alias match
    const aliasMatch = aliases.find((a) => a.toLowerCase() === nameLower)
    if (aliasMatch) {
      return {
        slug: entity.slug,
        name: entity.name,
        aliases,
        score: 0.95,
        reason: `Alias match: "${aliasMatch}"`
      }
    }

    // 3. Partial name match (one contains the other)
    if (entityNameLower.includes(nameLower) || nameLower.includes(entityNameLower)) {
      const score = Math.min(nameLower.length, entityNameLower.length) /
        Math.max(nameLower.length, entityNameLower.length)
      if (score >= this.fuzzyThreshold) {
        return {
          slug: entity.slug,
          name: entity.name,
          aliases,
          score: score * 0.85,
          reason: `Partial name match`
        }
      }
    }

    return null
  }

  private fuzzySearch(name: string, entities: EntitySummary[]): MatchCandidate[] {
    const index = entities.map((e) => ({
      slug: e.slug,
      name: e.name,
      aliases: (e.frontmatter.aliases as string[] | undefined) ?? [],
      searchText: [e.name, e.slug, ...((e.frontmatter.aliases as string[] | undefined) ?? [])].join(' ')
    }))

    const fuse = new Fuse(index, {
      keys: ['searchText'],
      threshold: this.fuzzyThreshold,
      includeScore: true
    })

    const results = fuse.search(name)
    return results.slice(0, this.maxCandidates).map((r) => ({
      slug: r.item.slug,
      name: r.item.name,
      aliases: r.item.aliases,
      score: r.score !== undefined ? 1 - r.score : 0.5,
      reason: 'Fuzzy slug/name match'
    }))
  }
}
