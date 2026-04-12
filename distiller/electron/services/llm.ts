import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import type {
  EntityType,
  ExtractionResult,
  ExtractedEntity,
  KnownEntity,
  Provider
} from '../../src/types/entities'

// ---------------------------------------------------------------------------
// JSON Schemas passed to the LLM as {json_schema} and used as tool input_schema
// ---------------------------------------------------------------------------

const BASE_ENTITY_PROPERTIES = {
  name: { type: 'string', description: 'Entity name as it appears in the text' },
  matched_slug: {
    type: ['string', 'null'],
    description: 'Slug of the matching existing entity, null if new'
  },
  possible_matches: {
    type: 'array',
    items: { type: 'string' },
    description: 'Slugs of entities that might match when uncertain'
  },
  confidence: {
    type: 'number',
    minimum: 0,
    maximum: 1,
    description: 'Confidence in the match/classification (0-1)'
  },
  reasoning: {
    type: 'string',
    description: 'Explanation of why this match/classification was made'
  }
} as const

const BODY_SECTIONS_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    required: ['section_name', 'content', 'mode'],
    properties: {
      section_name: { type: 'string' },
      content: { type: 'string' },
      mode: { type: 'string', enum: ['append', 'replace'] }
    }
  }
} as const

function makeEntitySchema(frontmatterProperties: Record<string, unknown>) {
  return {
    type: 'object',
    required: ['name', 'confidence', 'extracted_data', 'reasoning'],
    properties: {
      ...BASE_ENTITY_PROPERTIES,
      extracted_data: {
        type: 'object',
        properties: {
          frontmatter: { type: 'object', properties: frontmatterProperties },
          body_sections: BODY_SECTIONS_SCHEMA
        }
      }
    }
  }
}

const EXTRACTION_SCHEMAS: Record<EntityType, object> = {
  characters: {
    type: 'object',
    required: ['entities'],
    properties: {
      entities: {
        type: 'array',
        description: 'Characters extracted from the session text',
        items: makeEntitySchema({
          category: { type: 'string', enum: ['pc', 'npc'] },
          status: { type: 'string', enum: ['alive', 'dead', 'missing', 'unknown'] },
          race: { type: 'string' },
          class: { type: 'string' },
          aliases: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } }
        })
      }
    }
  },
  locations: {
    type: 'object',
    required: ['entities'],
    properties: {
      entities: {
        type: 'array',
        description: 'Locations extracted from the session text',
        items: makeEntitySchema({
          category: {
            type: 'string',
            enum: ['city', 'town', 'village', 'dungeon', 'region', 'wilderness', 'landmark', 'building']
          },
          parent_location: { type: 'string' },
          status: { type: 'string', enum: ['active', 'destroyed', 'abandoned', 'contested', 'unknown'] },
          tags: { type: 'array', items: { type: 'string' } }
        })
      }
    }
  },
  factions: {
    type: 'object',
    required: ['entities'],
    properties: {
      entities: {
        type: 'array',
        description: 'Factions and organizations extracted from the session text',
        items: makeEntitySchema({
          category: {
            type: 'string',
            enum: ['political', 'military', 'religious', 'criminal', 'mercantile', 'arcane', 'other']
          },
          status: { type: 'string', enum: ['active', 'disbanded', 'secret', 'destroyed', 'unknown'] },
          base_of_operations: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } }
        })
      }
    }
  },
  events: {
    type: 'object',
    required: ['entities'],
    properties: {
      entities: {
        type: 'array',
        description: 'Significant events extracted from the session text',
        items: makeEntitySchema({
          category: {
            type: 'string',
            enum: ['combat', 'social', 'exploration', 'discovery', 'political', 'catastrophe', 'ritual', 'other']
          },
          date_in_world: { type: 'string', description: 'Optional in-game date (free text)' },
          location: { type: 'string', description: 'Wiki-link to location, e.g. [[Valdris]]' },
          tags: { type: 'array', items: { type: 'string' } }
        })
      }
    }
  }
}

const TOOL_DESCRIPTIONS: Record<EntityType, string> = {
  characters: 'Extract characters mentioned in the D&D session recap',
  locations: 'Extract locations mentioned in the D&D session recap',
  factions: 'Extract factions and organizations mentioned in the D&D session recap',
  events: 'Extract significant narrative events from the D&D session recap'
}

// ---------------------------------------------------------------------------
// LLMService
// ---------------------------------------------------------------------------

export interface LLMServiceConfig {
  provider: Provider
  model: string
  apiKey: string       // empty string for ollama (no key required)
  temperature?: number
  promptsBasePath: string
  baseUrl?: string     // Ollama base URL, e.g. http://localhost:11434
}

export interface PromptFile {
  data: Record<string, unknown>
  body: string
}

export class LLMService {
  private anthropicClient?: Anthropic
  private openaiClient?: OpenAI

  constructor(private readonly config: LLMServiceConfig) {
    if (config.provider === 'anthropic') {
      this.anthropicClient = new Anthropic({ apiKey: config.apiKey })
    } else if (config.provider === 'openai') {
      this.openaiClient = new OpenAI({ apiKey: config.apiKey })
    } else {
      // ollama: OpenAI-compatible API, no real key needed
      this.openaiClient = new OpenAI({
        apiKey: 'ollama',
        baseURL: `${config.baseUrl ?? 'http://localhost:11434'}/v1`
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async extractEntities(
    entityType: EntityType,
    recapText: string,
    knownEntities: KnownEntity[]
  ): Promise<ExtractionResult> {
    const prompt = await this.loadPrompt(entityType)
    const filledPrompt = this.substituteVariables(prompt.body, {
      json_schema: JSON.stringify(EXTRACTION_SCHEMAS[entityType], null, 2),
      known_entities: this.formatKnownEntities(knownEntities),
      recap_text: recapText
    })

    if (this.config.provider === 'anthropic') {
      return this.callAnthropic(entityType, filledPrompt)
    }
    if (this.config.provider === 'ollama') {
      return this.callOllama(entityType, filledPrompt)
    }
    return this.callOpenAI(entityType, prompt.data.function_name as string, filledPrompt)
  }

  // ---------------------------------------------------------------------------
  // Prompt loading & variable substitution (exposed for testing)
  // ---------------------------------------------------------------------------

  async loadPrompt(entityType: EntityType): Promise<PromptFile> {
    const filePath = path.join(
      this.config.promptsBasePath,
      this.config.provider,
      `extract-${entityType}.md`
    )
    const raw = await fs.readFile(filePath, 'utf-8')
    const { data, content } = matter(raw)
    return { data, body: content.trim() }
  }

  substituteVariables(template: string, vars: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`)
  }

  buildAnthropicTool(entityType: EntityType): Anthropic.Tool {
    const toolName = `extract_${entityType}`
    return {
      name: toolName,
      description: TOOL_DESCRIPTIONS[entityType],
      input_schema: EXTRACTION_SCHEMAS[entityType] as Anthropic.Tool['input_schema']
    }
  }

  buildOpenAIFunction(entityType: EntityType, functionName: string): OpenAI.FunctionDefinition {
    return {
      name: functionName,
      description: TOOL_DESCRIPTIONS[entityType],
      parameters: EXTRACTION_SCHEMAS[entityType]
    }
  }

  // ---------------------------------------------------------------------------
  // Provider-specific API calls
  // ---------------------------------------------------------------------------

  private async callAnthropic(entityType: EntityType, filledPrompt: string): Promise<ExtractionResult> {
    const tool = this.buildAnthropicTool(entityType)
    const response = await this.anthropicClient!.messages.create({
      model: this.config.model,
      max_tokens: 4096,
      temperature: this.config.temperature ?? 0.3,
      tools: [tool],
      tool_choice: { type: 'any' },
      messages: [{ role: 'user', content: filledPrompt }]
    })
    return this.parseAnthropicResponse(response, entityType)
  }

  private async callOpenAI(
    entityType: EntityType,
    functionName: string,
    filledPrompt: string
  ): Promise<ExtractionResult> {
    const fn = this.buildOpenAIFunction(entityType, functionName)
    const response = await this.openaiClient!.chat.completions.create({
      model: this.config.model,
      temperature: this.config.temperature ?? 0.3,
      tools: [{ type: 'function', function: fn }],
      tool_choice: { type: 'function', function: { name: functionName } },
      messages: [{ role: 'user', content: filledPrompt }]
    })
    return this.parseOpenAIResponse(response, entityType)
  }

  private async callOllama(
    entityType: EntityType,
    filledPrompt: string
  ): Promise<ExtractionResult> {
    const response = await this.openaiClient!.chat.completions.create({
      model: this.config.model,
      temperature: this.config.temperature ?? 0.3,
      messages: [{ role: 'user', content: filledPrompt }]
    })
    return this.parseOpenAIContentResponse(response, entityType)
  }

  // ---------------------------------------------------------------------------
  // Response parsing
  // ---------------------------------------------------------------------------

  parseAnthropicResponse(
    response: Anthropic.Message,
    entityType: EntityType
  ): ExtractionResult {
    const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    if (!toolUse) {
      throw new Error(`Anthropic response contains no tool_use block for entity type "${entityType}"`)
    }
    const input = toolUse.input as { entities: ExtractedEntity[] }
    return {
      entity_type: entityType,
      entities: this.normalizeExtractedEntities(input.entities)
    }
  }

  parseOpenAIResponse(
    response: OpenAI.Chat.ChatCompletion,
    entityType: EntityType
  ): ExtractionResult {
    const message = response.choices[0]?.message
    const toolArgs = message?.tool_calls?.[0]?.function?.arguments
    const legacyFunctionArgs = (message as OpenAI.Chat.ChatCompletionMessage & {
      function_call?: { arguments?: string }
    } | undefined)?.function_call?.arguments
    const contentArgs = this.extractJsonFromOpenAIContent(message?.content)
    const rawArgs = toolArgs ?? legacyFunctionArgs ?? contentArgs

    if (!rawArgs) {
      const finishReason = response.choices[0]?.finish_reason ?? 'unknown'
      throw new Error(
        `OpenAI response contains no function call for entity type "${entityType}" (finish_reason: ${finishReason})`
      )
    }

    const parsed = this.parseExtractionJson(rawArgs) as { entities: ExtractedEntity[] }
    return {
      entity_type: entityType,
      entities: this.normalizeExtractedEntities(parsed.entities)
    }
  }

  parseOpenAIContentResponse(
    response: OpenAI.Chat.ChatCompletion,
    entityType: EntityType
  ): ExtractionResult {
    const rawContent = this.extractJsonFromOpenAIContent(response.choices[0]?.message?.content)
    if (!rawContent) {
      const finishReason = response.choices[0]?.finish_reason ?? 'unknown'
      throw new Error(
        `OpenAI-compatible response contains no JSON content for entity type "${entityType}" (finish_reason: ${finishReason})`
      )
    }

    const parsed = this.parseExtractionJson(rawContent) as { entities: ExtractedEntity[] }
    return {
      entity_type: entityType,
      entities: this.normalizeExtractedEntities(parsed.entities)
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private formatKnownEntities(entities: KnownEntity[]): string {
    if (entities.length === 0) return '(none)'
    return entities
      .map((e) => {
        const aliases = e.aliases.length > 0 ? ` (aliases: ${e.aliases.join(', ')})` : ''
        return `- ${e.name} [${e.slug}]${aliases}`
      })
      .join('\n')
  }

  private extractJsonFromOpenAIContent(
    content: OpenAI.Chat.ChatCompletionMessage['content'] | null | undefined
  ): string | null {
    if (typeof content === 'string') {
      return this.extractJsonObjectString(content)
    }

    if (!Array.isArray(content)) return null

    const textContent = content
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map((part) => part.text)
      .join('\n')
      .trim()

    return this.extractJsonObjectString(textContent)
  }

  private extractJsonObjectString(text: string): string | null {
    const trimmed = text.trim()
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed

    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
    if (fencedMatch?.[1]) {
      const fenced = fencedMatch[1].trim()
      if (fenced.startsWith('{') && fenced.endsWith('}')) return fenced
    }

    const firstBrace = trimmed.indexOf('{')
    const lastBrace = trimmed.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return trimmed.slice(firstBrace, lastBrace + 1)
    }

    return null
  }

  private parseExtractionJson(raw: string): unknown {
    try {
      return JSON.parse(raw)
    } catch (error) {
      const repaired = this.repairInvalidJsonEscapes(raw)
      if (repaired !== raw) {
        try {
          return JSON.parse(repaired)
        } catch {
          // Fall through to tolerant recovery below.
        }
      }

      const recovered = this.recoverEntitiesPayload(repaired)
      if (recovered) return recovered
      throw error
    }
  }

  private repairInvalidJsonEscapes(raw: string): string {
    let repaired = ''

    for (let i = 0; i < raw.length; i += 1) {
      const char = raw[i]
      if (char !== '\\') {
        repaired += char
        continue
      }

      const next = raw[i + 1]
      if (next && /["\\/bfnrtu]/.test(next)) {
        repaired += char
        continue
      }

      repaired += '\\\\'
    }

    return repaired
  }

  private recoverEntitiesPayload(raw: string): { entities: ExtractedEntity[] } | null {
    const entitiesIndex = raw.indexOf('"entities"')
    if (entitiesIndex < 0) return null

    const arrayStart = raw.indexOf('[', entitiesIndex)
    if (arrayStart < 0) return null

    const objects: ExtractedEntity[] = []
    let depth = 0
    let stringQuote = false
    let escaping = false
    let objectStart = -1

    for (let i = arrayStart; i < raw.length; i += 1) {
      const char = raw[i]

      if (stringQuote) {
        if (escaping) {
          escaping = false
          continue
        }
        if (char === '\\') {
          escaping = true
          continue
        }
        if (char === '"') {
          stringQuote = false
        }
        continue
      }

      if (char === '"') {
        stringQuote = true
        continue
      }

      if (char === '{') {
        if (depth === 0) objectStart = i
        depth += 1
        continue
      }

      if (char === '}') {
        depth -= 1
        if (depth === 0 && objectStart >= 0) {
          const candidate = raw.slice(objectStart, i + 1)
          try {
            objects.push(JSON.parse(candidate) as ExtractedEntity)
          } catch {
            // Skip malformed entity objects and continue recovering the rest.
          }
          objectStart = -1
        }
        continue
      }

      if (char === ']' && depth === 0) {
        break
      }
    }

    return objects.length > 0 ? { entities: objects } : null
  }

  private normalizeExtractedEntities(entities: unknown): ExtractedEntity[] {
    if (!Array.isArray(entities)) return []

    return entities
      .map((entity) => this.normalizeExtractedEntity(entity))
      .filter((entity): entity is ExtractedEntity => entity !== null)
  }

  private normalizeExtractedEntity(entity: unknown): ExtractedEntity | null {
    if (!entity || typeof entity !== 'object') return null

    const raw = entity as Record<string, unknown>
    const name = typeof raw.name === 'string' ? raw.name.trim() : ''
    if (!name) return null

    const extractedData =
      raw.extracted_data && typeof raw.extracted_data === 'object'
        ? raw.extracted_data as Record<string, unknown>
        : {}

    const frontmatter =
      extractedData.frontmatter && typeof extractedData.frontmatter === 'object'
        ? extractedData.frontmatter as Record<string, unknown>
        : {}

    const bodySectionsRaw = Array.isArray(extractedData.body_sections)
      ? extractedData.body_sections
      : []

    return {
      name,
      matched_slug: typeof raw.matched_slug === 'string' ? raw.matched_slug : null,
      possible_matches: Array.isArray(raw.possible_matches)
        ? raw.possible_matches.filter((item): item is string => typeof item === 'string')
        : [],
      confidence: typeof raw.confidence === 'number' && Number.isFinite(raw.confidence)
        ? raw.confidence
        : 0,
      reasoning: typeof raw.reasoning === 'string' ? raw.reasoning : '',
      extracted_data: {
        frontmatter,
        body_sections: bodySectionsRaw
          .filter((section): section is Record<string, unknown> => !!section && typeof section === 'object')
          .map((section) => ({
            section_name: typeof section.section_name === 'string' ? section.section_name : 'Description',
            content: typeof section.content === 'string' ? section.content : '',
            mode: section.mode === 'append' ? 'append' : 'replace'
          }))
      }
    }
  }
}
