import { ipcMain, safeStorage } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { StorageService } from '../services/storage'
import { MatcherService } from '../services/matcher'
import { LLMService } from '../services/llm'
import type { EntityType, EntityFile, KnownEntity, Provider, LLMConfig } from '../../src/types/entities'

interface HandlerContext {
  dataPath: string
  promptsBasePath: string
  configBasePath: string
  keysFilePath: string
}

export function registerHandlers(ctx: HandlerContext): void {
  const storage = new StorageService(ctx.dataPath)
  const matcher = new MatcherService(storage)

  // ---------------------------------------------------------------------------
  // Storage handlers
  // ---------------------------------------------------------------------------

  ipcMain.handle('storage:listEntities', (_e, entityType: EntityType) =>
    storage.listEntities(entityType)
  )

  ipcMain.handle('storage:getEntity', (_e, entityType: EntityType, slug: string) =>
    storage.getEntity(entityType, slug)
  )

  ipcMain.handle('storage:searchEntities', (_e, query: string) =>
    storage.searchEntities(query)
  )

  ipcMain.handle('storage:createEntity', (_e, entityType: EntityType, content: EntityFile) =>
    storage.createEntity(entityType, content)
  )

  ipcMain.handle(
    'storage:updateEntity',
    (_e, entityType: EntityType, slug: string, content: EntityFile) =>
      storage.updateEntity(entityType, slug, content)
  )

  ipcMain.handle('storage:findSimilarEntities', (_e, name: string, entityType: EntityType) =>
    matcher.findSimilarEntities(name, entityType)
  )

  ipcMain.handle('storage:entityExists', (_e, entityType: EntityType, slug: string) =>
    storage.entityExists(entityType, slug)
  )

  ipcMain.handle('storage:resolveWikiLinks', (_e, text: string) =>
    storage.resolveWikiLinks(text)
  )

  ipcMain.handle('storage:generateSlug', (_e, name: string, entityType: EntityType) =>
    storage.generateSlug(name, entityType)
  )

  ipcMain.handle('storage:getNextEventTimetrack', () =>
    storage.getNextEventTimetrack()
  )

  // ---------------------------------------------------------------------------
  // LLM handlers
  // ---------------------------------------------------------------------------

  ipcMain.handle(
    'llm:extractEntities',
    async (
      _e,
      provider: Provider,
      model: string,
      entityType: EntityType,
      recapText: string,
      knownEntities: KnownEntity[]
    ) => {
      let apiKey = ''
      let baseUrl: string | undefined

      if (provider === 'ollama') {
        const raw = await fs.readFile(path.join(ctx.configBasePath, 'llm.json'), 'utf-8')
        const llmConfig = JSON.parse(raw) as LLMConfig
        baseUrl = llmConfig.providers.ollama?.baseUrl
      } else {
        apiKey = await loadApiKey(ctx.keysFilePath, provider) ?? ''
        if (!apiKey) throw new Error(`API key for "${provider}" is not configured`)
      }

      const service = new LLMService({
        provider,
        model,
        apiKey,
        baseUrl,
        promptsBasePath: ctx.promptsBasePath
      })
      return service.extractEntities(entityType, recapText, knownEntities)
    }
  )

  // ---------------------------------------------------------------------------
  // Settings handlers
  // ---------------------------------------------------------------------------

  ipcMain.handle('settings:getApiKey', async (_e, provider: Provider) => {
    return loadApiKey(ctx.keysFilePath, provider)
  })

  ipcMain.handle('settings:setApiKey', async (_e, provider: Provider, key: string) => {
    return saveApiKey(ctx.keysFilePath, provider, key)
  })

  ipcMain.handle('settings:getLLMConfig', async () => {
    const raw = await fs.readFile(path.join(ctx.configBasePath, 'llm.json'), 'utf-8')
    return JSON.parse(raw) as LLMConfig
  })
}

// ---------------------------------------------------------------------------
// Key storage via safeStorage
// ---------------------------------------------------------------------------

async function loadKeysStore(filePath: string): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(filePath)
    if (!safeStorage.isEncryptionAvailable()) return JSON.parse(raw.toString('utf-8'))
    const decrypted = safeStorage.decryptString(raw)
    return JSON.parse(decrypted)
  } catch {
    return {}
  }
}

async function saveKeysStore(filePath: string, store: Record<string, string>): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const json = JSON.stringify(store)
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(json)
    await fs.writeFile(filePath, encrypted)
  } else {
    await fs.writeFile(filePath, json, 'utf-8')
  }
}

async function loadApiKey(filePath: string, provider: Provider): Promise<string | null> {
  const store = await loadKeysStore(filePath)
  return store[provider] ?? null
}

async function saveApiKey(filePath: string, provider: Provider, key: string): Promise<void> {
  const store = await loadKeysStore(filePath)
  store[provider] = key
  await saveKeysStore(filePath, store)
}
