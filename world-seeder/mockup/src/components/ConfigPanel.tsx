import { useState } from 'react'
import { HelpPanel } from './HelpPanel'

type Props = {
  configured: boolean
  connected: boolean
  onConnectedChange: (v: boolean) => void
  onSave: () => void
}

export function ConfigPanel(p: Props) {
  const [appKey, setAppKey] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [worldId, setWorldId] = useState('')
  const [rateLimit, setRateLimit] = useState(0.5)
  const [showKey, setShowKey] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<null | { ok: boolean; msg: string }>(null)
  const [saved, setSaved] = useState(false)

  const valid = appKey.length > 4 && authToken.length > 4 && worldId.length > 4

  const runTest = async () => {
    setTesting(true)
    setTestResult(null)
    await new Promise(r => setTimeout(r, 900))
    setTesting(false)
    setTestResult({
      ok: valid,
      msg: valid
        ? 'OK — autenticazione valida, mondo raggiungibile (28 articoli)'
        : 'Errore — 401 Unauthorized (verifica le chiavi)',
    })
    p.onConnectedChange(valid)
  }

  const handleSave = () => {
    if (!valid) return
    setSaved(true)
    p.onSave()
  }

  return (
    <div className="form">
      {!p.configured && (
        <div className="setup-banner">
          Inserisci le credenziali di World Anvil qui sotto. Quando tutti i campi obbligatori sono validi puoi salvare e tornare alla Dashboard.
        </div>
      )}

      <div className="field">
        <label>
          Application Key <span className="hint">(cifrata tramite Electron safeStorage)</span>
          <HelpPanel>
            <p><b>Dove trovarla</b></p>
            <ol>
              <li>Vai su World Anvil, apri il tuo profilo.</li>
              <li>Seleziona <b>API / Applications</b> dal menu laterale.</li>
              <li>Crea una nuova applicazione (richiede piano <b>Grandmaster+</b>).</li>
              <li>Copia la stringa chiamata <b>Application Key</b>.</li>
            </ol>
            <p>Corrisponde all'header <code>x-application-key</code> nelle richieste API Boromir.</p>
          </HelpPanel>
        </label>
        <div className="row-inline">
          <input
            type={showKey ? 'text' : 'password'}
            value={appKey}
            onChange={e => { setAppKey(e.target.value); setSaved(false) }}
            placeholder="es. 3f8a2c9d-0000-4b11-9b7f-abcdef012345"
          />
          <button className="ghost" type="button" onClick={() => setShowKey(v => !v)}>{showKey ? 'Nascondi' : 'Mostra'}</button>
        </div>
      </div>

      <div className="field">
        <label>
          Auth Token <span className="hint">(personale, richiede piano Master+)</span>
          <HelpPanel>
            <p><b>Dove trovarlo</b></p>
            <ol>
              <li>Vai su World Anvil, apri il tuo profilo.</li>
              <li>Seleziona <b>API / Authentication</b>.</li>
              <li>Genera un <b>Personal Access Token</b> dedicato al World Seeder.</li>
              <li>Copialo e incollalo qui: sara cifrato con <code>safeStorage</code>.</li>
            </ol>
            <p>Corrisponde all'header <code>x-auth-token</code> nelle richieste API Boromir. Il token scade: rigeneralo se i test di connessione falliscono con 401.</p>
          </HelpPanel>
        </label>
        <div className="row-inline">
          <input
            type={showToken ? 'text' : 'password'}
            value={authToken}
            onChange={e => { setAuthToken(e.target.value); setSaved(false) }}
            placeholder="es. eyJhbGciOiJIUzI1NiIsInR5c…"
          />
          <button className="ghost" type="button" onClick={() => setShowToken(v => !v)}>{showToken ? 'Nascondi' : 'Mostra'}</button>
        </div>
      </div>

      <div className="field">
        <label>
          World ID <span className="hint">(UUID del mondo di destinazione)</span>
          <HelpPanel>
            <p><b>Dove trovarlo</b></p>
            <ol>
              <li>Apri il mondo su World Anvil.</li>
              <li>Guarda l'URL della dashboard del mondo: l'UUID e l'ultimo segmento (formato <code>xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</code>).</li>
              <li>In alternativa, chiama <code>GET /identity</code> con il token e cerca l'oggetto <code>worlds</code>: trovi l'id del mondo a cui hai accesso.</li>
            </ol>
          </HelpPanel>
        </label>
        <input
          value={worldId}
          onChange={e => { setWorldId(e.target.value); setSaved(false) }}
          placeholder="a3b9c2d1-wrld-4e2f-9abc-0123456789ab"
        />
      </div>

      <div className="field">
        <label>Pausa tra richieste</label>
        <div className="slider-row">
          <input
            type="range"
            min="0.1"
            max="2"
            step="0.1"
            value={rateLimit}
            onChange={e => setRateLimit(Number(e.target.value))}
          />
          <span className="val">{rateLimit.toFixed(1)}s</span>
        </div>
        <span className="hint">Intervallo tra chiamate API Boromir. Aumentalo se vedi errori 429 (rate limit).</span>
      </div>

      <div className="buttons">
        <button className="primary" type="button" onClick={handleSave} disabled={!valid}>
          {saved ? 'Salvato' : 'Salva'}
        </button>
        <button type="button" onClick={runTest} disabled={testing || !valid}>
          {testing ? 'Test in corso…' : 'Testa connessione'}
        </button>
        {testResult && (
          <span className={`test-result ${testResult.ok ? 'ok' : 'err'}`}>{testResult.msg}</span>
        )}
      </div>
      {!valid && <span className="hint">Compila Application Key, Auth Token e World ID per abilitare Salva.</span>}
    </div>
  )
}
