import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export interface AppError {
  id: string
  message: string
  detail?: string
  createdAt: number
}

interface ErrorContextValue {
  errors: AppError[]
  pushError: (message: string, detail?: string) => string
  dismissError: (id: string) => void
}

const ErrorContext = createContext<ErrorContextValue | null>(null)

let nextErrorId = 0

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [errors, setErrors] = useState<AppError[]>([])

  const pushError = useCallback((message: string, detail?: string): string => {
    const id = `err-${++nextErrorId}`
    setErrors((prev) => [...prev, { id, message, detail, createdAt: Date.now() }])
    console.error(`[APP] ${message}`, detail ?? '')
    return id
  }, [])

  const dismissError = useCallback((id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const value = useMemo(
    () => ({ errors, pushError, dismissError }),
    [errors, pushError, dismissError]
  )

  return <ErrorContext.Provider value={value}>{children}</ErrorContext.Provider>
}

export function useErrors(): ErrorContextValue {
  const ctx = useContext(ErrorContext)
  if (!ctx) throw new Error('useErrors must be used inside <ErrorProvider>')
  return ctx
}

export function formatError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}
