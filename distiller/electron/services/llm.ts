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

const ts = () => new Date().toLocaleTimeString('it-IT', { hour12: false })

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
    console.log(`[LLM] ${ts()} → extractEntities  ${this.config.provider}/${this.config.model}  ${entityType}  recap: ${recapText.length} chars  known: ${knownEntities.length}`)
    try {
      const prompt = await this.loadPrompt(entityType)
      const filledPrompt = this.substituteVariables(prompt.body, {
        json_schema: JSON.stringify(EXTRACTION_SCHEMAS[entityType], null, 2),
        known_entities: this.formatKnownEntities(knownEntities),
        recap_text: recapText
      })

      const result = this.config.provider === 'anthropic'
        ? await this.callAnthropic(entityType, filledPrompt)
        : await this.callOpenAI(entityType, prompt.data.function_name as string, filledPrompt)

      console.log(`[LLM] ${ts()} ✓ extractEntities  ${entityType}  entities: ${result.entities.length}`)
      return result
    } catch (err) {
      console.error(`[LLM] ${ts()} ✗ extractEntities failed  ${entityType}`, err)
      throw err
    }
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
    console.log(`[LLM] ${ts()} read prompt  ${filePath}`)
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
    console.log(`[LLM] ${ts()} → Anthropic  model: ${this.config.model}  type: ${entityType}`)
    try {
      const response = await this.anthropicClient!.messages.create({
        model: this.config.model,
        max_tokens: 4096,
        temperature: this.config.temperature ?? 0.3,
        tools: [tool],
        tool_choice: { type: 'any' },
        messages: [{ role: 'user', content: filledPrompt }]
      })
      console.log(`[LLM] ${ts()} ← Anthropic  type: ${entityType}  in: ${response.usage.input_tokens}  out: ${response.usage.output_tokens}  stop: ${response.stop_reason}`)
      return this.parseAnthropicResponse(response, entityType)
    } catch (err) {
      console.error(`[LLM] ${ts()} ✗ Anthropic error  type: ${entityType}`, err)
      throw err
    }
  }

  private async callOpenAI(
    entityType: EntityType,
    functionName: string,
    filledPrompt: string
  ): Promise<ExtractionResult> {
    const fn = this.buildOpenAIFunction(entityType, functionName)
    const providerLabel = this.config.provider === 'ollama' ? 'Ollama' : 'OpenAI'
    console.log(`[LLM] ${ts()} → ${providerLabel}  model: ${this.config.model}  type: ${entityType}`)
    try {
      const response = await this.openaiClient!.chat.completions.create({
        model: this.config.model,
        temperature: this.config.temperature ?? 0.3,
        tools: [{ type: 'function', function: fn }],
        tool_choice: { type: 'function', function: { name: functionName } },
        messages: [{ role: 'user', content: filledPrompt }]
      })
      console.log(`[LLM] ${ts()} ← ${providerLabel}  type: ${entityType}  in: ${response.usage?.prompt_tokens ?? '?'}  out: ${response.usage?.completion_tokens ?? '?'}`)
      return this.parseOpenAIResponse(response, entityType)
    } catch (err) {
      console.error(`[LLM] ${ts()} ✗ ${providerLabel} error  type: ${entityType}`, err)
      throw err
    }
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
      entities: input.entities ?? []
    }
  }

  parseOpenAIResponse(
    response: OpenAI.Chat.ChatCompletion,
    entityType: EntityType
  ): ExtractionResult {
    const toolCall = response.choices[0]?.message?.tool_calls?.[0]
    if (!toolCall?.function?.arguments) {
      throw new Error(`OpenAI response contains no function call for entity type "${entityType}"`)
    }
    const parsed = JSON.parse(toolCall.function.arguments) as { entities: ExtractedEntity[] }
    return {
      entity_type: entityType,
      entities: parsed.entities ?? []
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
}
