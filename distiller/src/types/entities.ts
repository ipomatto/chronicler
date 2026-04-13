export type EntityType = 'characters' | 'locations' | 'factions' | 'events'

export type Provider = 'openai' | 'anthropic' | 'ollama'

// ---------------------------------------------------------------------------
// Frontmatter shapes per entity type
// ---------------------------------------------------------------------------

export interface CharacterFrontmatter {
  name: string
  slug: string
  type: 'character'
  category: 'pc' | 'npc'
  status: 'alive' | 'dead' | 'missing' | 'unknown'
  race: string
  class: string
  aliases: string[]
  tags: string[]
  last_updated: string
  sessione?: string
}

export interface LocationFrontmatter {
  name: string
  slug: string
  type: 'location'
  category: 'city' | 'town' | 'village' | 'dungeon' | 'region' | 'wilderness' | 'landmark' | 'building'
  parent_location: string
  status: 'active' | 'destroyed' | 'abandoned' | 'contested' | 'unknown'
  tags: string[]
  last_updated: string
  sessione?: string
}

export interface FactionFrontmatter {
  name: string
  slug: string
  type: 'faction'
  category: 'political' | 'military' | 'religious' | 'criminal' | 'mercantile' | 'arcane' | 'other'
  status: 'active' | 'disbanded' | 'secret' | 'destroyed' | 'unknown'
  base_of_operations: string
  tags: string[]
  last_updated: string
  sessione?: string
}

export interface EventFrontmatter {
  name: string
  slug: string
  type: 'event'
  timetrack: number
  category: 'combat' | 'social' | 'exploration' | 'discovery' | 'political' | 'catastrophe' | 'ritual' | 'other'
  date_in_world: string
  location: string
  tags: string[]
  last_updated: string
  sessione?: string
}

export type EntityFrontmatter =
  | CharacterFrontmatter
  | LocationFrontmatter
  | FactionFrontmatter
  | EventFrontmatter

// ---------------------------------------------------------------------------
// Storage API types
// ---------------------------------------------------------------------------

export interface EntitySummary {
  slug: string
  name: string
  type: EntityType
  frontmatter: Record<string, unknown>
}

export interface EntityFile {
  frontmatter: Record<string, unknown>
  body: string
}

export interface MatchCandidate {
  slug: string
  name: string
  aliases: string[]
  score: number
  reason: string
}

export interface ResolvedLink {
  text: string
  slug: string | null
  entityType: EntityType | null
  ambiguous: boolean
}

// ---------------------------------------------------------------------------
// LLM extraction types
// ---------------------------------------------------------------------------

export interface KnownEntity {
  slug: string
  name: string
  aliases: string[]
}

export interface BodySection {
  section_name: string
  content: string
  mode: 'append' | 'replace'
}

export interface ExtractedEntity {
  name: string
  matched_slug: string | null
  possible_matches: string[]
  confidence: number
  extracted_data: {
    frontmatter: Partial<Record<string, unknown>>
    body_sections: BodySection[]
  }
  reasoning: string
}

export interface TokenUsage {
  input: number
  output: number
}

export interface ExtractionResult {
  entity_type: EntityType
  entities: ExtractedEntity[]
  usage: TokenUsage | null   // null when the provider doesn't report it (e.g. Ollama)
}

// ---------------------------------------------------------------------------
// Config file shapes
// ---------------------------------------------------------------------------

export interface ModelConfig {
  id: string
  name: string
  maxTokens: number
  supportsJsonMode?: boolean
  supportsFunctionCalling?: boolean
  supportsToolUse?: boolean
}

export interface ProviderConfig {
  models: ModelConfig[]
  defaultModel: string
  defaultTemperature: number
  baseUrl?: string  // used by Ollama (default: http://localhost:11434)
}

export interface LLMConfig {
  providers: {
    openai: ProviderConfig
    anthropic: ProviderConfig
    ollama: ProviderConfig
  }
}

export interface AppConfig {
  storage: {
    dataPath: string
  }
  matching: {
    fuzzyThreshold: number
    maxCandidates: number
  }
  ui: {
    language: string
  }
  fingerprintThreshold?: number
}

// ---------------------------------------------------------------------------
// Session fingerprint (duplicate detection)
// ---------------------------------------------------------------------------

export interface SessionFingerprint {
  sessione: string
  date: string
  simhash: string
  preview: string
}

export interface FingerprintMatch {
  fingerprint: SessionFingerprint
  distance: number
}

// ---------------------------------------------------------------------------
// Index
// ---------------------------------------------------------------------------

export interface IndexStats {
  rebuiltAt: string                    // ISO datetime
  counts: Record<EntityType, number>   // entities per type
  total: number
}

// ---------------------------------------------------------------------------
// Linking helpers
// ---------------------------------------------------------------------------

export interface UnlinkedMatch {
  entityName: string
  entityType: EntityType
  entitySlug: string
  count: number   // number of unlinked occurrences found in the body
}

// ---------------------------------------------------------------------------
// IPC bridge type (used in preload + renderer)
// ---------------------------------------------------------------------------

export interface ChroniclerBridge {
  // Storage
  listEntities: (entityType: EntityType) => Promise<EntitySummary[]>
  getEntity: (entityType: EntityType, slug: string) => Promise<EntityFile>
  searchEntities: (query: string) => Promise<EntitySummary[]>
  createEntity: (entityType: EntityType, content: EntityFile) => Promise<void>
  updateEntity: (entityType: EntityType, slug: string, content: EntityFile) => Promise<void>
  findSimilarEntities: (name: string, entityType: EntityType) => Promise<MatchCandidate[]>
  entityExists: (entityType: EntityType, slug: string) => Promise<boolean>
  resolveWikiLinks: (text: string) => Promise<ResolvedLink[]>
  generateSlug: (name: string, entityType: EntityType) => Promise<string>
  getNextEventTimetrack: () => Promise<number>
  findUnlinkedOccurrences: (body: string) => Promise<UnlinkedMatch[]>
  getEntityCounts: () => Promise<IndexStats>
  rebuildIndex: () => Promise<IndexStats>
  indexExists: () => Promise<boolean>
  // Session fingerprint
  checkFingerprint: (recapText: string) => Promise<FingerprintMatch | null>
  recordFingerprint: (sessione: string, recapText: string) => Promise<void>
  // LLM
  extractEntities: (
    provider: Provider,
    model: string,
    entityType: EntityType,
    recapText: string,
    knownEntities: KnownEntity[]
  ) => Promise<ExtractionResult>
  // Settings
  getApiKey: (provider: Provider) => Promise<string | null>
  setApiKey: (provider: Provider, key: string) => Promise<void>
  getLLMConfig: () => Promise<LLMConfig>
}

declare global {
  interface Window {
    chronicler: ChroniclerBridge
  }
}
