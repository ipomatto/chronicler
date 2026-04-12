import { contextBridge, ipcRenderer } from 'electron'
import type { ChroniclerBridge } from '../src/types/entities'

const bridge: ChroniclerBridge = {
  // Storage
  listEntities: (entityType) => ipcRenderer.invoke('storage:listEntities', entityType),
  getEntity: (entityType, slug) => ipcRenderer.invoke('storage:getEntity', entityType, slug),
  searchEntities: (query) => ipcRenderer.invoke('storage:searchEntities', query),
  createEntity: (entityType, content) => ipcRenderer.invoke('storage:createEntity', entityType, content),
  updateEntity: (entityType, slug, content) =>
    ipcRenderer.invoke('storage:updateEntity', entityType, slug, content),
  findSimilarEntities: (name, entityType) =>
    ipcRenderer.invoke('storage:findSimilarEntities', name, entityType),
  entityExists: (entityType, slug) => ipcRenderer.invoke('storage:entityExists', entityType, slug),
  resolveWikiLinks: (text) => ipcRenderer.invoke('storage:resolveWikiLinks', text),
  generateSlug: (name, entityType) => ipcRenderer.invoke('storage:generateSlug', name, entityType),
  getNextEventTimetrack: () => ipcRenderer.invoke('storage:getNextEventTimetrack'),
  findUnlinkedOccurrences: (body) => ipcRenderer.invoke('storage:findUnlinkedOccurrences', body),
  getEntityCounts: () => ipcRenderer.invoke('storage:getEntityCounts'),
  rebuildIndex: () => ipcRenderer.invoke('storage:rebuildIndex'),
  indexExists: () => ipcRenderer.invoke('storage:indexExists'),

  // LLM
  extractEntities: (provider, model, entityType, recapText, knownEntities) =>
    ipcRenderer.invoke('llm:extractEntities', provider, model, entityType, recapText, knownEntities),

  // Settings
  getApiKey: (provider) => ipcRenderer.invoke('settings:getApiKey', provider),
  setApiKey: (provider, key) => ipcRenderer.invoke('settings:setApiKey', provider, key),
  getLLMConfig: () => ipcRenderer.invoke('settings:getLLMConfig')
}

contextBridge.exposeInMainWorld('chronicler', bridge)
