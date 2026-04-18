import { useEffect, useState } from 'react'
import SessionInput from './components/SessionInput'
import ExtractionReview from './components/ExtractionReview'
import StorageBrowser from './components/StorageBrowser'
import Settings from './components/Settings'
import IndexTools from './components/IndexTools'
import ErrorBoundary from './components/ErrorBoundary'
import ErrorToast from './components/ErrorToast'
import { ErrorProvider } from './contexts/ErrorContext'
import type { ExtractionResult, Provider, ConfigStatus } from './types/entities'

type Screen = 'input' | 'review' | 'browser' | 'tools' | 'settings'

interface ExtractionSession {
  results: ExtractionResult[]
  provider: Provider
  model: string
  sessione: string
}

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorProvider>
        <AppShell />
        <ErrorToast />
      </ErrorProvider>
    </ErrorBoundary>
  )
}

function AppShell() {
  const [screen, setScreen] = useState<Screen>('input')
  const [session, setSession] = useState<ExtractionSession | null>(null)
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null)
  const [bannerDismissed, setBannerDismissed] = useState(false)

  useEffect(() => {
    window.chronicler.getConfigStatus().then(setConfigStatus).catch(() => {
      // Non-fatal: if the status call fails, just skip the banner.
    })
  }, [])

  const regeneratedFiles: string[] = []
  if (configStatus?.appRegenerated) regeneratedFiles.push('app.json')
  if (configStatus?.llmRegenerated) regeneratedFiles.push('llm.json')
  const showBanner = !bannerDismissed && regeneratedFiles.length > 0

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
      {showBanner && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '8px 16px',
            background: '#4a3a12',
            color: '#fde68a',
            borderBottom: '1px solid #78510f',
            fontSize: 13
          }}
        >
          <span>
            File di configurazione rigenerati con i valori di default:{' '}
            <strong>{regeneratedFiles.join(', ')}</strong>. Modifica da{' '}
            <em>Impostazioni</em> se necessario.
          </span>
          <button
            onClick={() => setBannerDismissed(true)}
            aria-label="Chiudi avviso"
            style={{
              background: 'transparent',
              color: '#fde68a',
              border: '1px solid #78510f',
              padding: '2px 8px',
              cursor: 'pointer'
            }}
          >
            ×
          </button>
        </div>
      )}
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
