import { useState, useEffect } from 'react'
import type { ExtractionResult, LLMConfig, Provider } from '../types/entities'
import { useExtraction } from '../hooks/useExtraction'

interface Props {
  onComplete: (results: ExtractionResult[], provider: Provider, model: string) => void
}

export default function SessionInput({ onComplete }: Props) {
  const [recapText, setRecapText] = useState('')
  const [provider, setProvider] = useState<Provider>('anthropic')
  const [model, setModel] = useState('')
  const [llmConfig, setLlmConfig] = useState<LLMConfig | null>(null)

  const { extractAll, progress, startTimes, counts, isExtracting, error } = useExtraction()
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!isExtracting) return
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [isExtracting])

  useEffect(() => {
    window.chronicler.getLLMConfig().then((cfg) => {
      setLlmConfig(cfg)
      setModel(cfg.providers[provider].defaultModel)
    })
  }, [])

  useEffect(() => {
    if (llmConfig) setModel(llmConfig.providers[provider].defaultModel)
  }, [provider, llmConfig])

  async function handleExtract() {
    if (!recapText.trim()) return
    const results = await extractAll(recapText, provider, model)
    if (results) onComplete(results, provider, model)
  }

  const models = llmConfig?.providers[provider]?.models ?? []

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 24px' }}>
      <h2 style={{ marginBottom: 24 }}>Nuova Sessione</h2>

      {/* Provider + model selector */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 4, color: 'var(--text-muted)', fontSize: 12 }}>
            Provider
          </label>
          <select value={provider} onChange={(e) => setProvider(e.target.value as Provider)}>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="ollama">Ollama (locale)</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4, color: 'var(--text-muted)', fontSize: 12 }}>
            Modello
          </label>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Text area */}
      <textarea
        value={recapText}
        onChange={(e) => setRecapText(e.target.value)}
        placeholder="Incolla qui il testo del recap di sessione..."
        style={{ width: '100%', height: 320, resize: 'vertical', marginBottom: 16 }}
      />

      {/* Progress */}
      {isExtracting && (
        <div style={{ marginBottom: 16, padding: 12, background: 'var(--surface)', borderRadius: 'var(--radius)' }}>
          {(['characters', 'locations', 'factions', 'events'] as const).map((type) => {
            const state = progress[type]
            const elapsed = startTimes[type] != null ? Math.floor((Date.now() - startTimes[type]!) / 1000) : 0
            return (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0, background:
                  state === 'done' ? '#22c55e' :
                  state === 'error' ? '#f87171' :
                  state === 'loading' ? 'var(--accent)' : 'var(--border)'
                }} />
                <span style={{ textTransform: 'capitalize', color: 'var(--text-muted)', minWidth: 80 }}>{type}</span>
                {state === 'loading' && (
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{elapsed}s…</span>
                )}
                {state === 'done' && (
                  <span style={{ color: '#22c55e', fontSize: 12 }}>ok, trovate: {counts[type]} entità</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 16, color: '#f87171' }}>{error}</div>
      )}

      <button
        className="primary"
        onClick={handleExtract}
        disabled={isExtracting || !recapText.trim()}
        style={{ width: '100%', padding: '10px' }}
      >
        {isExtracting ? 'Estrazione in corso…' : 'Estrai Entità'}
      </button>
    </div>
  )
}
