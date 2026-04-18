type Props = {
  onGoToConfig: () => void
}

export function NotConfigured({ onGoToConfig }: Props) {
  return (
    <div className="empty-setup">
      <div className="empty-setup-icon">?</div>
      <h2>Configurazione richiesta</h2>
      <p>Prima di poter sincronizzare con World Anvil devi inserire le tue credenziali API e il World ID di destinazione.</p>
      <button className="primary" onClick={onGoToConfig}>Vai a Configurazione</button>
    </div>
  )
}
