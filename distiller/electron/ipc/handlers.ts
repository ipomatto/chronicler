import { ipcMain, safeStorage } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { StorageService } from '../services/storage'
import { MatcherService } from '../services/matcher'
import { LLMService } from '../services/llm'
import { SessionFingerprintService } from '../services/sessionFingerprint'
import type {
  EntityType,
  EntityFile,
  KnownEntity,
  Provider,
  LLMConfig,
  AppConfig,
  ConfigStatus
} from '../../src/types/entities'

interface HandlerContext {
  dataPath: string
  promptsBasePath: string
  configBasePath: string
  keysFilePath: string
}

// Defaults are the source of truth when config files are missing or corrupt.
// Keep them in sync with config/app.json and config/llm.json shipped in the
// repo.
const DEFAULT_APP_CONFIG: AppConfig = {
  storage: { dataPath: './data' },
  matching: { fuzzyThreshold: 0.4, maxCandidates: 5 },
  ui: { language: 'it' }
}

const DEFAULT_LLM_CONFIG: LLMConfig = {
  providers: {
    openai: {
      models: [
        { id: 'gpt-4o', name: 'GPT-4o', maxTokens: 4096, supportsJsonMode: true, supportsFunctionCalling: true },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', maxTokens: 4096, supportsJsonMode: true, supportsFunctionCalling: true }
      ],
      defaultModel: 'gpt-4o',
      defaultTemperature: 0.3
    },
    anthropic: {
      models: [
        { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', maxTokens: 4096, supportsToolUse: true },
        { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', maxTokens: 4096, supportsToolUse: true }
      ],
      defaultModel: 'claude-sonnet-4-20250514',
      defaultTemperature: 0.3
    },
    ollama: {
      baseUrl: 'http://localhost:11434',
      models: [
        { id: 'llama3.1', name: 'Llama 3.1 (8B)', maxTokens: 4096, supportsFunctionCalling: true },
        { id: 'llama3.1:70b', name: 'Llama 3.1 (70B)', maxTokens: 4096, supportsFunctionCalling: true },
        { id: 'llama3.2', name: 'Llama 3.2 (3B)', maxTokens: 4096, supportsFunctionCalling: true },
        { id: 'llama3', name: 'Llama 3 (8B)', maxTokens: 4096, supportsFunctionCalling: true }
      ],
      defaultModel: 'llama3.1',
      defaultTemperature: 0.3
    }
  }
}

async function ensureConfig<T>(
  filePath: string,
  defaults: T
): Promise<{ config: T; regenerated: boolean }> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return { config: JSON.parse(raw) as T, regenerated: false }
  } catch (err) {
    console.warn(`[IPC] config missing or corrupt, regenerating  ${filePath}`, err)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(defaults, null, 2), 'utf-8')
    return { config: defaults, regenerated: true }
  }
}

export async function registerHandlers(ctx: HandlerContext): Promise<void> {
  const storage = new StorageService(ctx.dataPath)
  const matcher = new MatcherService(storage)

  // Ensure config files exist at boot so the app never crashes on a missing
  // or corrupt config. If any was regenerated, the renderer is notified via
  // config:getStatus and can surface a banner.
  const appConfigPath = path.join(ctx.configBasePath, 'app.json')
  const llmConfigPath = path.join(ctx.configBasePath, 'llm.json')
  const appResult = await ensureConfig<AppConfig>(appConfigPath, DEFAULT_APP_CONFIG)
  const llmResult = await ensureConfig<LLMConfig>(llmConfigPath, DEFAULT_LLM_CONFIG)
  const configStatus: ConfigStatus = {
    appRegenerated: appResult.regenerated,
    llmRegenerated: llmResult.regenerated
  }

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

  ipcMain.handle('storage:findUnlinkedOccurrences', (_e, body: string) =>
    storage.findUnlinkedOccurrences(body)
  )

  ipcMain.handle('storage:rebuildIndex', () =>
    storage.rebuildIndex()
  )

  ipcMain.handle('storage:getEntityCounts', () =>
    storage.getEntityCounts()
  )

  ipcMain.handle('storage:indexExists', () =>
    storage.indexExists()
  )

  // Ensure index.md exists on startup; rebuild silently if missing
  fs.access(path.join(ctx.dataPath, 'index.md')).catch(() => { void storage.rebuildIndex() })

  // ---------------------------------------------------------------------------
  // Session fingerprint handlers
  // ---------------------------------------------------------------------------

  const fingerprint = new SessionFingerprintService(ctx.dataPath)

  ipcMain.handle('session:checkFingerprint', async (_e, recapText: string) => {
    const { config } = await ensureConfig<AppConfig>(appConfigPath, DEFAULT_APP_CONFIG)
    const threshold = config.fingerprintThreshold ?? 10
    return fingerprint.checkFingerprint(recapText, threshold)
  })

  ipcMain.handle('session:recordFingerprint', async (_e, sessione: string, recapText: string) => {
    return fingerprint.recordFingerprint(sessione, recapText)
  })

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
        const { config: llmConfig } = await ensureConfig<LLMConfig>(llmConfigPath, DEFAULT_LLM_CONFIG)
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
    const { config } = await ensureConfig<LLMConfig>(llmConfigPath, DEFAULT_LLM_CONFIG)
    return config
  })

  // ---------------------------------------------------------------------------
  // Config handlers
  // ---------------------------------------------------------------------------

  ipcMain.handle('config:getStatus', () => configStatus)
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
