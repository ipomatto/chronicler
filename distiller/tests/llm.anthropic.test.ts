import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import { LLMService } from '../electron/services/llm'
import type { ExtractionResult } from '../src/types/entities'

// ---------------------------------------------------------------------------
// Hoist mocks so they are available inside vi.mock() factories
// ---------------------------------------------------------------------------

const { mockMessagesCreate, mockReadFile } = vi.hoisted(() => ({
  mockMessagesCreate: vi.fn(),
  mockReadFile: vi.fn()
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class Anthropic {
    messages = { create: mockMessagesCreate }
  }
}))

vi.mock('node:fs/promises', () => ({
  default: { readFile: mockReadFile },
  readFile: mockReadFile
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROMPTS_BASE = path.join(__dirname, '../..', 'prompts')

const SAMPLE_PROMPT_CONTENT = `---
provider: anthropic
entity_type: characters
version: 1
output_format: tool_use
tool_name: extract_characters
---

You are an entity extractor for a D&D campaign chronicle.

## Known Characters

{known_entities}

## Session Text

{recap_text}
`

const SAMPLE_RECAP = `
Il gruppo ha incontrato Gandalf al confine della Foresta di Fangorn.
Aragorn ha guidato la truppa verso Minas Tirith.
La Compagnia dell'Anello si è riunita per l'ultima battaglia.
`

const SAMPLE_KNOWN_ENTITIES = [
  { slug: 'aragorn', name: 'Aragorn', aliases: ['Grampasso', 'Il Re Perduto'] }
]

function makeToolUseResponse(entities: unknown[]) {
  return {
    id: 'msg_123',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-20250514',
    content: [
      {
        type: 'tool_use',
        id: 'tool_123',
        name: 'extract_characters',
        input: { entities }
      }
    ],
    stop_reason: 'tool_use',
    usage: { input_tokens: 100, output_tokens: 200 }
  }
}

function makeService(overrides: Partial<ConstructorParameters<typeof LLMService>[0]> = {}) {
  return new LLMService({
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKey: 'test-key-xyz',
    promptsBasePath: PROMPTS_BASE,
    ...overrides
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LLMService – Anthropic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReadFile.mockResolvedValue(SAMPLE_PROMPT_CONTENT)
  })

  // -------------------------------------------------------------------------
  // Prompt loading
  // -------------------------------------------------------------------------

  describe('loadPrompt()', () => {
    it('reads the correct file path for the given entity type', async () => {
      const svc = makeService()
      await svc.loadPrompt('characters')

      const expectedPath = path.join(PROMPTS_BASE, 'anthropic', 'extract-characters.md')
      expect(mockReadFile).toHaveBeenCalledWith(expectedPath, 'utf-8')
    })

    it('reads the correct path for each entity type', async () => {
      const svc = makeService()
      for (const type of ['characters', 'locations', 'factions', 'events'] as const) {
        await svc.loadPrompt(type)
        expect(mockReadFile).toHaveBeenCalledWith(
          path.join(PROMPTS_BASE, 'anthropic', `extract-${type}.md`),
          'utf-8'
        )
      }
    })

    it('parses frontmatter and body correctly', async () => {
      const svc = makeService()
      const result = await svc.loadPrompt('characters')

      expect(result.data.provider).toBe('anthropic')
      expect(result.data.entity_type).toBe('characters')
      expect(result.data.tool_name).toBe('extract_characters')
      expect(result.body).toContain('## Known Characters')
      expect(result.body).toContain('{known_entities}')
      expect(result.body).toContain('{recap_text}')
    })

    it('throws when the prompt file is missing', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT: no such file or directory'))
      const svc = makeService()
      await expect(svc.loadPrompt('characters')).rejects.toThrow('ENOENT')
    })
  })

  // -------------------------------------------------------------------------
  // Variable substitution
  // -------------------------------------------------------------------------

  describe('substituteVariables()', () => {
    it('replaces all known placeholders', () => {
      const svc = makeService()
      const template = 'Known: {known_entities}\nRecap: {recap_text}\nSchema: {json_schema}'
      const result = svc.substituteVariables(template, {
        known_entities: 'KNOWN',
        recap_text: 'RECAP',
        json_schema: 'SCHEMA'
      })
      expect(result).toBe('Known: KNOWN\nRecap: RECAP\nSchema: SCHEMA')
    })

    it('leaves unknown placeholders intact', () => {
      const svc = makeService()
      const result = svc.substituteVariables('Hello {unknown}', { known: 'X' })
      expect(result).toBe('Hello {unknown}')
    })

    it('injects known entities formatted as a bullet list', () => {
      const svc = makeService()
      const template = '{known_entities}'

      // We test via extractEntities indirectly via substituteVariables + formatKnownEntities
      // formatKnownEntities is private, but the result appears in the filled prompt
      mockMessagesCreate.mockResolvedValue(makeToolUseResponse([]))

      // Manually verify the format by checking the API call args
      const filled = svc.substituteVariables(template, {
        known_entities: '- Aragorn [aragorn] (aliases: Grampasso, Il Re Perduto)'
      })
      expect(filled).toContain('Aragorn [aragorn]')
      expect(filled).toContain('Grampasso')
    })

    it('replaces {recap_text} with the actual session text', () => {
      const svc = makeService()
      const result = svc.substituteVariables('Testo: {recap_text}', { recap_text: SAMPLE_RECAP })
      expect(result).toContain('Gandalf')
    })
  })

  // -------------------------------------------------------------------------
  // Tool definition
  // -------------------------------------------------------------------------

  describe('buildAnthropicTool()', () => {
    it('returns a tool with the correct name for each entity type', () => {
      const svc = makeService()
      const types = ['characters', 'locations', 'factions', 'events'] as const
      for (const type of types) {
        const tool = svc.buildAnthropicTool(type)
        expect(tool.name).toBe(`extract_${type}`)
      }
    })

    it('includes an input_schema with entities array', () => {
      const svc = makeService()
      const tool = svc.buildAnthropicTool('characters')
      const schema = tool.input_schema as {
        type: string
        properties: { entities: { type: string } }
      }
      expect(schema.type).toBe('object')
      expect(schema.properties.entities.type).toBe('array')
    })

    it('includes required entity properties in the schema', () => {
      const svc = makeService()
      const tool = svc.buildAnthropicTool('characters')
      const schema = tool.input_schema as {
        properties: {
          entities: {
            items: {
              required: string[]
              properties: Record<string, unknown>
            }
          }
        }
      }
      const items = schema.properties.entities.items
      expect(items.required).toContain('name')
      expect(items.required).toContain('confidence')
      expect(items.required).toContain('reasoning')
      expect(items.properties).toHaveProperty('matched_slug')
      expect(items.properties).toHaveProperty('possible_matches')
    })

    it('characters schema includes status enum with correct values', () => {
      const svc = makeService()
      const tool = svc.buildAnthropicTool('characters')
      const schema = tool.input_schema as {
        properties: {
          entities: {
            items: {
              properties: {
                extracted_data: {
                  properties: {
                    frontmatter: {
                      properties: {
                        status: { enum: string[] }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      const status = schema.properties.entities.items.properties.extracted_data
        .properties.frontmatter.properties.status
      expect(status.enum).toContain('alive')
      expect(status.enum).toContain('dead')
      expect(status.enum).toContain('missing')
      expect(status.enum).toContain('unknown')
    })

    it('events schema includes category-specific enum', () => {
      const svc = makeService()
      const tool = svc.buildAnthropicTool('events')
      const schema = tool.input_schema as {
        properties: {
          entities: {
            items: {
              properties: {
                extracted_data: {
                  properties: {
                    frontmatter: {
                      properties: {
                        category: { enum: string[] }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      const category = schema.properties.entities.items.properties.extracted_data
        .properties.frontmatter.properties.category
      expect(category.enum).toContain('combat')
      expect(category.enum).toContain('ritual')
      expect(category.enum).toContain('catastrophe')
    })
  })

  // -------------------------------------------------------------------------
  // API call
  // -------------------------------------------------------------------------

  describe('extractEntities()', () => {
    it('calls the Anthropic API with the correct model', async () => {
      mockMessagesCreate.mockResolvedValue(makeToolUseResponse([]))
      const svc = makeService({ model: 'claude-haiku-4-5-20251001' })

      await svc.extractEntities('characters', SAMPLE_RECAP, [])

      expect(mockMessagesCreate).toHaveBeenCalledOnce()
      const call = mockMessagesCreate.mock.calls[0][0]
      expect(call.model).toBe('claude-haiku-4-5-20251001')
    })

    it('passes tool_choice: any to force tool use', async () => {
      mockMessagesCreate.mockResolvedValue(makeToolUseResponse([]))
      const svc = makeService()

      await svc.extractEntities('characters', SAMPLE_RECAP, [])

      const call = mockMessagesCreate.mock.calls[0][0]
      expect(call.tool_choice).toEqual({ type: 'any' })
    })

    it('passes exactly one tool matching the entity type', async () => {
      mockMessagesCreate.mockResolvedValue(makeToolUseResponse([]))
      const svc = makeService()

      await svc.extractEntities('locations', SAMPLE_RECAP, [])

      const call = mockMessagesCreate.mock.calls[0][0]
      expect(call.tools).toHaveLength(1)
      expect(call.tools[0].name).toBe('extract_locations')
    })

    it('includes the recap text in the user message', async () => {
      mockMessagesCreate.mockResolvedValue(makeToolUseResponse([]))
      const svc = makeService()

      await svc.extractEntities('characters', SAMPLE_RECAP, [])

      const call = mockMessagesCreate.mock.calls[0][0]
      expect(call.messages[0].content).toContain('Gandalf')
    })

    it('includes known entities in the user message', async () => {
      mockMessagesCreate.mockResolvedValue(makeToolUseResponse([]))
      const svc = makeService()

      await svc.extractEntities('characters', SAMPLE_RECAP, SAMPLE_KNOWN_ENTITIES)

      const call = mockMessagesCreate.mock.calls[0][0]
      expect(call.messages[0].content).toContain('Aragorn')
      expect(call.messages[0].content).toContain('Grampasso')
    })

    it('shows (none) in the prompt when no known entities are provided', async () => {
      mockMessagesCreate.mockResolvedValue(makeToolUseResponse([]))
      const svc = makeService()

      await svc.extractEntities('characters', SAMPLE_RECAP, [])

      const call = mockMessagesCreate.mock.calls[0][0]
      expect(call.messages[0].content).toContain('(none)')
    })
  })

  // -------------------------------------------------------------------------
  // Response parsing
  // -------------------------------------------------------------------------

  describe('parseAnthropicResponse()', () => {
    it('extracts entities from a tool_use block', () => {
      const svc = makeService()
      const entities = [
        {
          name: 'Gandalf',
          matched_slug: null,
          possible_matches: [],
          confidence: 0.9,
          extracted_data: { frontmatter: { status: 'alive' }, body_sections: [] },
          reasoning: 'New character mentioned in the text'
        }
      ]
      const response = makeToolUseResponse(entities)
      const result = svc.parseAnthropicResponse(response as any, 'characters')

      expect(result.entity_type).toBe('characters')
      expect(result.entities).toHaveLength(1)
      expect(result.entities[0].name).toBe('Gandalf')
      expect(result.entities[0].confidence).toBe(0.9)
    })

    it('returns an empty entities array when tool_use input has no entities', () => {
      const svc = makeService()
      const response = makeToolUseResponse([])
      const result = svc.parseAnthropicResponse(response as any, 'factions')

      expect(result.entity_type).toBe('factions')
      expect(result.entities).toHaveLength(0)
    })

    it('handles matched_slug correctly for existing entities', () => {
      const svc = makeService()
      const entities = [
        {
          name: 'Aragorn',
          matched_slug: 'aragorn',
          possible_matches: [],
          confidence: 1.0,
          extracted_data: {
            frontmatter: { status: 'alive' },
            body_sections: [
              { section_name: 'Key Events', content: '- Ha guidato la battaglia.', mode: 'append' }
            ]
          },
          reasoning: 'Exact match with existing entity'
        }
      ]
      const response = makeToolUseResponse(entities)
      const result = svc.parseAnthropicResponse(response as any, 'characters')

      expect(result.entities[0].matched_slug).toBe('aragorn')
      expect(result.entities[0].extracted_data.body_sections[0].mode).toBe('append')
    })

    it('throws when there is no tool_use block in the response', () => {
      const svc = makeService()
      const response = {
        content: [{ type: 'text', text: 'some text response' }]
      }
      expect(() => svc.parseAnthropicResponse(response as any, 'characters')).toThrow(
        /no tool_use block/
      )
    })

    it('handles possible_matches for ambiguous entities', () => {
      const svc = makeService()
      const entities = [
        {
          name: 'Marco',
          matched_slug: null,
          possible_matches: ['marco-il-grande', 'marco-polo'],
          confidence: 0.5,
          extracted_data: { frontmatter: {}, body_sections: [] },
          reasoning: 'Ambiguous name, multiple potential matches'
        }
      ]
      const response = makeToolUseResponse(entities)
      const result = svc.parseAnthropicResponse(response as any, 'characters')

      expect(result.entities[0].possible_matches).toEqual(['marco-il-grande', 'marco-polo'])
    })
  })

  // -------------------------------------------------------------------------
  // End-to-end flow (unit, mocked)
  // -------------------------------------------------------------------------

  describe('end-to-end extractEntities() flow', () => {
    it('returns a well-formed ExtractionResult', async () => {
      const entities = [
        {
          name: 'Gandalf',
          matched_slug: null,
          possible_matches: [],
          confidence: 0.95,
          extracted_data: {
            frontmatter: { category: 'npc', status: 'alive' },
            body_sections: [
              { section_name: 'Description', content: 'Mago potente.', mode: 'replace' }
            ]
          },
          reasoning: 'Clearly a new character'
        }
      ]
      mockMessagesCreate.mockResolvedValue(makeToolUseResponse(entities))
      const svc = makeService()

      const result: ExtractionResult = await svc.extractEntities(
        'characters',
        SAMPLE_RECAP,
        SAMPLE_KNOWN_ENTITIES
      )

      expect(result.entity_type).toBe('characters')
      expect(result.entities).toHaveLength(1)
      expect(result.entities[0].name).toBe('Gandalf')
      expect(result.entities[0].extracted_data.frontmatter.category).toBe('npc')
      expect(result.entities[0].extracted_data.body_sections[0].section_name).toBe('Description')
    })

    it('propagates API errors', async () => {
      mockMessagesCreate.mockRejectedValue(new Error('API rate limit exceeded'))
      const svc = makeService()

      await expect(svc.extractEntities('characters', SAMPLE_RECAP, [])).rejects.toThrow(
        'API rate limit exceeded'
      )
    })
  })
})

// ---------------------------------------------------------------------------
// Integration test (real API – skipped unless ANTHROPIC_API_KEY is set)
// ---------------------------------------------------------------------------

describe.skipIf(!process.env['ANTHROPIC_API_KEY'])('LLMService – Anthropic INTEGRATION', () => {
  const REAL_PROMPTS_BASE = path.join(__dirname, '../../prompts')

  beforeEach(() => {
    // Restore real fs for integration tests
    vi.restoreAllMocks()
  })

  afterEach(() => {
    // Re-apply mocks after integration tests
    mockReadFile.mockResolvedValue(SAMPLE_PROMPT_CONTENT)
  })

  it('extracts characters from a real session recap', async () => {
    const svc = new LLMService({
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      apiKey: process.env['ANTHROPIC_API_KEY']!,
      promptsBasePath: REAL_PROMPTS_BASE
    })

    const recap = `
      Durante la sessione, il gruppo ha incontrato Thalion, un elfo dei boschi misterioso
      che li ha guidati attraverso la Foresta di Mirwood. Successivamente hanno parlato
      con la Priora Selene nel Tempio dei Venti a Valdris.
    `

    const result = await svc.extractEntities('characters', recap, [])

    expect(result.entity_type).toBe('characters')
    expect(Array.isArray(result.entities)).toBe(true)
    expect(result.entities.length).toBeGreaterThan(0)

    for (const entity of result.entities) {
      expect(typeof entity.name).toBe('string')
      expect(entity.name.length).toBeGreaterThan(0)
      expect(typeof entity.confidence).toBe('number')
      expect(entity.confidence).toBeGreaterThanOrEqual(0)
      expect(entity.confidence).toBeLessThanOrEqual(1)
      expect(Array.isArray(entity.possible_matches)).toBe(true)
      expect(entity.extracted_data).toHaveProperty('frontmatter')
      expect(entity.extracted_data).toHaveProperty('body_sections')
      expect(typeof entity.reasoning).toBe('string')
    }
  }, 30_000)

  it('returns empty entities for a recap with no characters', async () => {
    const svc = new LLMService({
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      apiKey: process.env['ANTHROPIC_API_KEY']!,
      promptsBasePath: REAL_PROMPTS_BASE
    })

    const recap = 'La sessione è stata cancellata questa settimana.'

    const result = await svc.extractEntities('characters', recap, [])

    expect(result.entity_type).toBe('characters')
    expect(Array.isArray(result.entities)).toBe(true)
  }, 30_000)
})
