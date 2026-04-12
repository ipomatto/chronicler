import { useEffect, useState } from 'react'
import type { Provider } from '../types/entities'

const API_KEY_PROVIDERS: Provider[] = ['anthropic', 'openai']

export default function Settings() {
  const [keys, setKeys] = useState<Partial<Record<Provider, string>>>({})
  const [saved, setSaved] = useState<Partial<Record<Provider, boolean>>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all(
      API_KEY_PROVIDERS.map((p) =>
        window.chronicler.getApiKey(p).then((k) => ({ provider: p, key: k ?? '' }))
      )
    ).then((results) => {
      const map: Partial<Record<Provider, string>> = {}
      for (const { provider, key } of results) map[provider] = key
      setKeys(map)
      setLoading(false)
    })
  }, [])

  async function save(provider: Provider) {
    const key = keys[provider] ?? ''
    await window.chronicler.setApiKey(provider, key)
    setSaved((prev) => ({ ...prev, [provider]: true }))
    setTimeout(() => setSaved((prev) => ({ ...prev, [provider]: false })), 2000)
  }

  if (loading) {
    return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Caricamento…</div>
  }

  return (
    <div style={{ maxWidth: 560, margin: '40px auto', padding: '0 24px' }}>
      <h2 style={{ marginBottom: 24 }}>Impostazioni</h2>

      <h3 style={{ marginBottom: 16, fontSize: 14, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
        API Keys
      </h3>

      {API_KEY_PROVIDERS.map((provider) => (
        <div key={provider} style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 6, textTransform: 'capitalize', fontWeight: 600 }}>
            {provider}
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="password"
              value={keys[provider] ?? ''}
              onChange={(e) => setKeys((prev) => ({ ...prev, [provider]: e.target.value }))}
              placeholder={`Chiave API ${provider}…`}
              style={{ flex: 1 }}
            />
            <button
              className={saved[provider] ? undefined : 'primary'}
              onClick={() => save(provider)}
            >
              {saved[provider] ? 'Salvato ✓' : 'Salva'}
            </button>
          </div>
          <p style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            La chiave è cifrata e salvata localmente.
          </p>
        </div>
      ))}

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
          Ollama (locale)
        </label>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
          Nessuna API key necessaria. Assicurati che Ollama sia in esecuzione
          prima di avviare l&apos;estrazione.
        </p>
        <p style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
          URL di default: <code>http://localhost:11434</code> — modificabile in{' '}
          <code>config/llm.json</code>.
        </p>
      </div>
    </div>
  )
}
