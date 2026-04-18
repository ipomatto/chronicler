import { ActionSpec } from '../data'

type Props = {
  action: ActionSpec | null
  dryRun: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ action, dryRun, onConfirm, onCancel }: Props) {
  if (!action) return null
  const showDryHint = !action.readOnly
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{action.title}</h2>
        <div className="modal-body">
          {action.description.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
          {showDryHint && dryRun && (
            <p className="modal-note">Dry-run e <b>attivo</b>: nessuna scrittura reale su World Anvil.</p>
          )}
          {action.variant === 'danger' && (
            <p className="modal-warn">Verifica prima che nessun altro seeder stia girando sullo stesso mondo.</p>
          )}
        </div>
        <div className="modal-actions">
          <button onClick={onCancel}>Annulla</button>
          <button className={action.variant} onClick={onConfirm}>{action.confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
