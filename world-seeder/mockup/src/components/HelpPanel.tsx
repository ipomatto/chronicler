import { ReactNode, useState } from 'react'

export function HelpPanel({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="help-icon"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Nascondi aiuto' : 'Mostra aiuto'}
      >
        ?
      </button>
      {open && <div className="help-panel">{children}</div>}
    </>
  )
}
