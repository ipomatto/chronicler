import { useState, useEffect } from 'react'
import type { ExtractionResult, FingerprintMatch, IndexStats, LLMConfig, Provider } from '../types/entities'
import { useExtraction } from '../hooks/useExtraction'

interface Props {
  onComplete: (results: ExtractionResult[], provider: Provider, model: string, sessione: string) => void
}

type IndexStatus = 'checking' | 'rebuilding' | 'ready'

export default function SessionInput({ onComplete }: Props) {
  const [recapText, setRecapText] = useState('')
  const [provider, setProvider] = useState<Provider>('anthropic')
  const [model, setModel] = useState('')
  const [llmConfig, setLlmConfig] = useState<LLMConfig | null>(null)

  const [indexStatus, setIndexStatus] = useState<IndexStatus>('checking')
  const [indexStats, setIndexStats] = useState<IndexStats | null>(null)
  const [indexRebuilt, setIndexRebuilt] = useState(false)

  const [fingerprintWarning, setFingerprintWarning] = useState<FingerprintMatch | null>(null)

  const { extractAll, progress, startTimes, counts, tokenUsage, isExtracting, error } = useExtraction()
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

  useEffect(() => {
    void (async () => {
      const exists = await window.chronicler.indexExists()
      if (!exists) {
        setIndexStatus('rebuilding')
        const stats = await window.chronicler.rebuildIndex()
        setIndexStats(stats)
        setIndexRebuilt(true)
      } else {
        const stats = await window.chronicler.getEntityCounts()
        setIndexStats(stats)
        setIndexRebuilt(false)
      }
      setIndexStatus('ready')
    })()
  }, [])

  async function handleExtract() {
    if (!recapText.trim()) return

    // Check for duplicate session via SimHash fingerprint
    const match = await window.chronicler.checkFingerprint(recapText)
    if (match) {
      setFingerprintWarning(match)
      return
    }

    await runExtraction()
  }

  async function runExtraction() {
    setFingerprintWarning(null)
    const sessione = crypto.randomUUID()
    const results = await extractAll(recapText, provider, model)
    if (results) {
      await window.chronicler.recordFingerprint(sessione, recapText)
      onComplete(results, provider, model, sessione)
    }
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
          {tokenUsage.input > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              Tokens: {tokenUsage.input.toLocaleString()} in / {tokenUsage.output.toLocaleString()} out
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 16, color: '#f87171' }}>{error}</div>
      )}

      {/* Fingerprint duplicate warning */}
      {fingerprintWarning && (
        <div style={{
          marginBottom: 16,
          padding: 12,
          background: 'rgba(251, 191, 36, 0.1)',
          border: '1px solid #fbbf24',
          borderRadius: 'var(--radius)',
          fontSize: 13
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6, color: '#f59e0b' }}>
            Sessione simile rilevata
          </div>
          <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>
            Data: {fingerprintWarning.fingerprint.date} — Distanza: {fingerprintWarning.distance} bit
          </div>
          <div style={{ color: 'var(--text-muted)', marginBottom: 8, fontStyle: 'italic' }}>
            &ldquo;{fingerprintWarning.fingerprint.preview}&rdquo;
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setFingerprintWarning(null)} style={{ fontSize: 12 }}>
              Annulla
            </button>
            <button className="primary" onClick={runExtraction} style={{ fontSize: 12 }}>
              Procedi comunque
            </button>
          </div>
        </div>
      )}

      <button
        className="primary"
        onClick={handleExtract}
        disabled={isExtracting || !recapText.trim()}
        style={{ width: '100%', padding: '10px' }}
      >
        {isExtracting ? 'Estrazione in corso…' : 'Estrai Entità'}
      </button>

      {/* Index status bar */}
      <div style={{
        marginTop: 24,
        padding: '8px 12px',
        borderRadius: 'var(--radius)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        fontSize: 12,
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        {indexStatus === 'checking' && (
          <>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
            Verifica indice…
          </>
        )}
        {indexStatus === 'rebuilding' && (
          <>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
            Ricostruzione indice in corso…
          </>
        )}
        {indexStatus === 'ready' && indexStats && (
          <>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
            <span>
              Indice{indexRebuilt ? ' (ricostruito)' : ''}: {indexStats.counts.characters} personaggi,{' '}
              {indexStats.counts.locations} luoghi, {indexStats.counts.factions} fazioni,{' '}
              {indexStats.counts.events} eventi — {indexStats.total} totali
            </span>
          </>
        )}
      </div>
    </div>
  )
}
