import { useMemo } from 'react'
import { detectInBrowser } from './capabilities'
import './App.css'

function App() {
  const results = useMemo(() => detectInBrowser(), [])
  const allOk = results.every((r) => r.supported)

  return (
    <main className="check">
      <h1>Photo Studio</h1>
      <p>Phase 0: browser capability check</p>
      <ul>
        {results.map((r) => (
          <li key={r.key} data-supported={r.supported}>
            <span aria-hidden="true">{r.supported ? '✅' : '❌'}</span> {r.label}
          </li>
        ))}
      </ul>
      <p className="summary">
        {allOk
          ? 'This browser supports everything the app needs.'
          : 'Some features are missing in this browser.'}
      </p>
      <p className="ua">{navigator.userAgent}</p>
    </main>
  )
}

export default App
