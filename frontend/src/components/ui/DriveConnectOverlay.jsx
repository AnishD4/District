import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { BuildingLogo } from './BuildingLogo'

export function DriveConnectOverlay() {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    api.getDriveStatus()
      .then(result => {
        if (!cancelled) setStatus(result)
      })
      .catch(err => {
        console.error('Failed to read Drive status:', err)
        if (!cancelled) {
          setError('Could not reach the backend to check Google Drive.')
          setStatus({ configured: false, connected: false })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (!status || status.connected) return null

  const configured = Boolean(status.configured)

  const connectDrive = () => {
    if (!configured) return
    window.location.href = '/api/drive/auth'
  }

  return (
    <div className="drive-connect-overlay">
      <div className="glass-panel drive-connect-card">
        <div className="drive-connect-card__header">
          <p className="drive-connect-card__eyebrow">
            Google Drive
          </p>
          <h1>
            Connect your Drive to build the city
          </h1>
        </div>

        <p className="drive-connect-card__copy">
          District will ask for read access, then turn each top-level Google Drive folder into a building.
          Loose files in My Drive are ignored.
        </p>

        {!configured && (
          <div className="drive-connect-card__warning">
            Google OAuth is not configured yet. Add <code>GOOGLE_CLIENT_ID</code> and{' '}
            <code>GOOGLE_CLIENT_SECRET</code> to <code>.env</code> at the project root or{' '}
            <code>backend/.env</code>, then restart the backend.
            {status.redirectUri && (
              <div className="drive-connect-card__redirect">
                Redirect URI: <code>{status.redirectUri}</code>
              </div>
            )}
          </div>
        )}

        {(error || status.error) && (
          <p className="drive-connect-card__error">
            {error || status.error}
          </p>
        )}

        <button
          onClick={connectDrive}
          className="btn-accent drive-connect-card__button"
          disabled={!configured}
        >
          <BuildingLogo size={18} />
          {configured ? 'Connect Google Drive' : 'OAuth Not Configured'}
        </button>
      </div>
    </div>
  )
}
