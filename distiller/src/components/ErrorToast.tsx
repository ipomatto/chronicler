import { useEffect, useState } from 'react'
import { useErrors } from '../contexts/ErrorContext'
import type { AppError } from '../contexts/ErrorContext'

const AUTO_DISMISS_MS = 8000

export default function ErrorToast() {
  const { errors, dismissError } = useErrors()

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 1000,
        maxWidth: 420
      }}
    >
      {errors.map((err) => (
        <ToastItem key={err.id} error={err} onDismiss={() => dismissError(err.id)} />
      ))}
    </div>
  )
}

function ToastItem({ error, onDismiss }: { error: AppError; onDismiss: () => void }) {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div
      role="alert"
      style={{
        background: '#3a1a1a',
        color: '#fecaca',
        border: '1px solid #7f1d1d',
        borderRadius: 6,
        padding: '10px 12px',
        fontSize: 13,
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ flex: 1, fontWeight: 500 }}>{error.message}</span>
        <button
          onClick={onDismiss}
          aria-label="Chiudi errore"
          style={{
            background: 'transparent',
            color: '#fecaca',
            border: 'none',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            padding: 0
          }}
        >
          ×
        </button>
      </div>
      {error.detail && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: 'transparent',
              color: '#fca5a5',
              border: 'none',
              cursor: 'pointer',
              fontSize: 11,
              padding: 0,
              textAlign: 'left',
              textDecoration: 'underline'
            }}
          >
            {expanded ? 'Nascondi dettagli' : 'Mostra dettagli'}
          </button>
          {expanded && (
            <pre
              style={{
                margin: 0,
                fontSize: 11,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                background: 'rgba(0,0,0,0.2)',
                padding: 8,
                borderRadius: 4,
                maxHeight: 160,
                overflow: 'auto'
              }}
            >
              {error.detail}
            </pre>
          )}
        </>
      )}
    </div>
  )
}
