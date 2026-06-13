import { useEffect, useState } from 'react'
import { api } from '../../lib/api'

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
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(6, 6, 10, 0.72)',
      backdropFilter: 'blur(8px)',
      pointerEvents: 'auto',
      padding: '20px',
    }}>
      <div className="glass-panel" style={{
        width: 'min(460px, 100%)',
        borderRadius: '14px',
        padding: '24px',
        boxShadow: '0 20px 80px rgba(0,0,0,0.45)',
      }}>
        <div style={{ marginBottom: '18px' }}>
          <p style={{
            color: 'var(--accent)',
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '8px',
          }}>
            Google Drive
          </p>
          <h1 style={{
            margin: 0,
            color: 'white',
            fontSize: '24px',
            fontFamily: "'Space Grotesk', sans-serif",
          }}>
            Connect your Drive to build the city
          </h1>
        </div>

        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '14px',
          lineHeight: 1.6,
          marginBottom: '18px',
        }}>
          District will ask for read access, then turn each top-level Google Drive folder into a building.
          Loose files in My Drive are ignored.
        </p>

        {!configured && (
          <div style={{
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '12px',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            lineHeight: 1.5,
            marginBottom: '16px',
            background: 'rgba(255,255,255,0.03)',
          }}>
            Google OAuth is not configured yet. Add the Google client ID and secret to
            <code style={{ margin: '0 4px' }}>backend/.env</code>
            and restart the backend.
            {status.redirectUri && (
              <div style={{ marginTop: '8px' }}>
                Redirect URI: <code>{status.redirectUri}</code>
              </div>
            )}
          </div>
        )}

        {(error || status.error) && (
          <p style={{ color: '#ff6b6b', fontSize: '12px', lineHeight: 1.5, marginBottom: '16px' }}>
            {error || status.error}
          </p>
        )}

        <button
          onClick={connectDrive}
          className="btn-accent"
          disabled={!configured}
          style={{ width: '100%', padding: '12px 16px' }}
        >
          {configured ? 'Connect Google Drive' : 'OAuth Not Configured'}
        </button>
      </div>
    </div>
  )
}
