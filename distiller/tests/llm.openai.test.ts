import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'node:path'
import { LLMService } from '../electron/services/llm'

const { mockCreate, mockReadFile } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockReadFile: vi.fn()
}))

vi.mock('openai', () => ({
  default: class OpenAI {
    chat = {
      completions: {
        create: mockCreate
      }
    }
  }
}))

vi.mock('node:fs/promises', () => ({
  default: { readFile: mockReadFile },
  readFile: mockReadFile
}))

const PROMPTS_BASE = path.join(__dirname, '../..', 'prompts')

const SAMPLE_PROMPT_CONTENT = `---
provider: openai
entity_type: locations
version: 1
output_format: json
function_name: extract_locations
---

Return extracted locations.

{recap_text}
`

function makeService() {
  return new LLMService({
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: 'test-key',
    promptsBasePath: PROMPTS_BASE
  })
}

describe('LLMService - OpenAI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReadFile.mockResolvedValue(SAMPLE_PROMPT_CONTENT)
  })

  it('parses tool_calls responses', () => {
    const svc = makeService()
    const response = {
      choices: [
        {
          finish_reason: 'tool_calls',
          message: {
            tool_calls: [
              {
                function: {
                  name: 'extract_locations',
                  arguments: JSON.stringify({ entities: [{ name: 'Valdris', confidence: 0.9 }] })
                }
              }
            ]
          }
        }
      ]
    }

    const result = svc.parseOpenAIResponse(response as any, 'locations')
    expect(result.entities[0].name).toBe('Valdris')
  })

  it('parses legacy function_call responses', () => {
    const svc = makeService()
    const response = {
      choices: [
        {
          finish_reason: 'function_call',
          message: {
            function_call: {
              name: 'extract_locations',
              arguments: JSON.stringify({ entities: [{ name: 'Porto Vecchio', confidence: 0.8 }] })
            }
          }
        }
      ]
    }

    const result = svc.parseOpenAIResponse(response as any, 'locations')
    expect(result.entities[0].name).toBe('Porto Vecchio')
  })

  it('parses JSON returned in message content as a fallback', () => {
    const svc = makeService()
    const response = {
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: JSON.stringify({ entities: [{ name: 'Molo Sette', confidence: 0.7 }] })
          }
        }
      ]
    }

    const result = svc.parseOpenAIResponse(response as any, 'locations')
    expect(result.entities[0].name).toBe('Molo Sette')
  })

  it('parses JSON wrapped in markdown fences from message content', () => {
    const svc = makeService()
    const response = {
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: '```json\n{"entities":[{"name":"Valdris","confidence":0.7}]}\n```'
          }
        }
      ]
    }

    const result = svc.parseOpenAIContentResponse(response as any, 'locations')
    expect(result.entities[0].name).toBe('Valdris')
  })

  it('repairs invalid JSON escapes before parsing', () => {
    const svc = makeService()
    const response = {
      choices: [
        {
          finish_reason: 'tool_calls',
          message: {
            tool_calls: [
              {
                function: {
                  name: 'extract_locations',
                  arguments: '{"entities":[{"name":"Valdris","confidence":0.7,"reasoning":"bad \\q escape"}]}'
                }
              }
            ]
          }
        }
      ]
    }

    const result = svc.parseOpenAIResponse(response as any, 'locations')
    expect(result.entities[0].name).toBe('Valdris')
  })

  it('recovers valid entities from a malformed entities array', () => {
    const svc = makeService()
    const response = {
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: `{
              "entities": [
                {
                  "name": "Valdris",
                  "confidence": 0.9,
                  "reasoning": "city",
                  "extracted_data": { "frontmatter": {}, "body_sections": [] }
                }
                {
                  "name": "Porto Vecchio",
                  "confidence": 0.8,
                  "reasoning": "district",
                  "extracted_data": { "frontmatter": {}, "body_sections": [] }
                }
              ]
            }`
          }
        }
      ]
    }

    const result = svc.parseOpenAIContentResponse(response as any, 'locations')
    expect(result.entities).toHaveLength(2)
    expect(result.entities[0].name).toBe('Valdris')
    expect(result.entities[1].name).toBe('Porto Vecchio')
  })

  it('passes the configured function tool to the OpenAI API', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          finish_reason: 'tool_calls',
          message: {
            tool_calls: [
              {
                function: {
                  name: 'extract_locations',
                  arguments: JSON.stringify({ entities: [] })
                }
              }
            ]
          }
        }
      ]
    })

    const svc = makeService()
    await svc.extractEntities('locations', 'Valdris sorge sulla costa.', [])

    expect(mockCreate).toHaveBeenCalledOnce()
    const call = mockCreate.mock.calls[0][0]
    expect(call.tools).toHaveLength(1)
    expect(call.tools[0].function.name).toBe('extract_locations')
    expect(call.tool_choice).toEqual({
      type: 'function',
      function: { name: 'extract_locations' }
    })
  })
})
