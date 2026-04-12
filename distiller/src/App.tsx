import { useState } from 'react'
import SessionInput from './components/SessionInput'
import ExtractionReview from './components/ExtractionReview'
import StorageBrowser from './components/StorageBrowser'
import Settings from './components/Settings'
import IndexTools from './components/IndexTools'
import type { ExtractionResult, Provider } from './types/entities'

type Screen = 'input' | 'review' | 'browser' | 'tools' | 'settings'

interface ExtractionSession {
  results: ExtractionResult[]
  provider: Provider
  model: string
  sessione: string
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('input')
  const [session, setSession] = useState<ExtractionSession | null>(null)

  function handleExtractionComplete(results: ExtractionResult[], provider: Provider, model: string, sessione: string) {
    setSession({ results, provider, model, sessione })
    setScreen('review')
  }

  function handleReviewDone() {
    setSession(null)
    setScreen('input')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Nav */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '8px 16px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)'
      }}>
        <span style={{ fontWeight: 700, marginRight: 16, color: 'var(--accent)' }}>
          Chronicler
        </span>
        {([
          ['input',    'Nuova Sessione'],
          ['browser',  'Archivio'],
          ['tools',    'Strumenti'],
          ['settings', 'Impostazioni'],
        ] as [Screen, string][]).map(([s, label]) => (
          <button
            key={s}
            onClick={() => setScreen(s)}
            style={{
              background: screen === s ? 'var(--surface2)' : 'transparent',
              border: screen === s ? '1px solid var(--border)' : '1px solid transparent'
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        {screen === 'input' && (
          <SessionInput onComplete={handleExtractionComplete} />
        )}
        {screen === 'review' && session && (
          <ExtractionReview
            results={session.results}
            sessione={session.sessione}
            onDone={handleReviewDone}
          />
        )}
        {screen === 'browser' && <StorageBrowser />}
        {screen === 'tools' && <IndexTools />}
        {screen === 'settings' && <Settings />}
      </main>
    </div>
  )
}
