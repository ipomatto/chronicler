import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[APP] ErrorBoundary caught', error, info.componentStack)
  }

  private handleReset = () => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          role="alert"
          style={{
            padding: 32,
            maxWidth: 640,
            margin: '80px auto',
            background: '#3a1a1a',
            color: '#fecaca',
            border: '1px solid #7f1d1d',
            borderRadius: 8
          }}
        >
          <h2 style={{ marginTop: 0 }}>Si è verificato un errore inatteso</h2>
          <p>L'applicazione ha incontrato un problema che ne ha interrotto l'esecuzione.</p>
          <pre
            style={{
              background: 'rgba(0,0,0,0.3)',
              padding: 12,
              borderRadius: 4,
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 200,
              overflow: 'auto'
            }}
          >
            {this.state.error.message}
            {this.state.error.stack ? `\n\n${this.state.error.stack}` : ''}
          </pre>
          <button
            onClick={this.handleReset}
            style={{
              marginTop: 12,
              background: '#7f1d1d',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            Riprova
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
