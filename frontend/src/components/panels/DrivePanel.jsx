import { useEffect, useState } from 'react'
import { api } from '../../lib/api'

function getMimeIcon(mimeType) {
  if (mimeType?.includes('folder')) return '[Folder]'
  if (mimeType?.includes('document')) return '[Doc]'
  if (mimeType?.includes('spreadsheet')) return '[Sheet]'
  if (mimeType?.includes('presentation')) return '[Slides]'
  if (mimeType?.includes('pdf')) return '[PDF]'
  if (mimeType?.includes('image')) return '[Img]'
  return '[File]'
}

export function DrivePanel({ building }) {
  const isDriveFolder = building.source === 'drive' || building.drive_folder_id === building.id
  const [files, setFiles] = useState([])
  const [connected, setConnected] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [demoMode, setDemoMode] = useState(false)
  const [redirectUri, setRedirectUri] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importSummary, setImportSummary] = useState(null)
  const [error, setError] = useState('')

  const refreshDriveState = async () => {
    setLoading(true)
    setError('')
    try {
      const [status, fileResult] = await Promise.all([
        api.getDriveStatus(building.id),
        api.getDriveFiles(building.id),
      ])

      setConfigured(Boolean(status.configured || fileResult.configured))
      setConnected(Boolean(status.connected || fileResult.connected))
      setDemoMode(Boolean(status.demo || fileResult.demo || building.demo))
      setRedirectUri(status.redirectUri || null)
      setFiles(fileResult.files || [])
      setImportSummary(null)

      if (fileResult.error) {
        setError(fileResult.error)
      }
    } catch (err) {
      console.error('Failed to load Drive state:', err)
      setError('Failed to load Drive state from the backend.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshDriveState()
  }, [building.id])

  const connectDrive = () => {
    if (!configured) return
    window.location.href = isDriveFolder ? '/api/drive/auth' : `/api/drive/auth?building_id=${building.id}`
  }

  const syncFolder = async () => {
    const folderId = prompt('Paste a Google Drive folder ID from the folder URL:')
    if (!folderId) return

    setSyncing(true)
    setError('')
    try {
      const result = await api.syncDrive(building.id, folderId.trim())
      if (result.error) {
        setError(result.error)
      }
      await refreshDriveState()
      api.embed(building.id)
    } catch (err) {
      console.error('Drive sync failed:', err)
      setError('Drive sync failed. Check the folder ID and Drive permissions.')
    } finally {
      setSyncing(false)
    }
  }

  const importRecentFiles = async () => {
    setImporting(true)
    setError('')
    setImportSummary(null)
    try {
      const result = await api.importDriveFiles(building.id, { limit: 25 })
      if (result.error) {
        setError(result.error)
        return
      }

      setImportSummary(result)
      if (result.files) {
        setFiles(result.files)
      }
      api.embed(building.id)
    } catch (err) {
      console.error('Drive import failed:', err)
      setError('Drive import failed. Check Drive access and try again.')
    } finally {
      setImporting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
        Loading Drive...
      </div>
    )
  }

  if (!connected) {
    return (
      <div style={{
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
      }}>
        <div style={{ fontSize: '28px', color: 'var(--accent)' }}>[Drive]</div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>
          Connect Google Drive to populate this building with your files.
        </p>

        {!configured && (
          <div style={{
            width: '100%',
            padding: '12px',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.03)',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            lineHeight: 1.5,
          }}>
            Google OAuth is not configured yet. Add `GOOGLE_CLIENT_ID` and
            `GOOGLE_CLIENT_SECRET` to `backend/.env`, then restart the backend.
            {redirectUri && (
              <div style={{ marginTop: '8px' }}>
                Redirect URI: <code>{redirectUri}</code>
              </div>
            )}
          </div>
        )}

        {error && (
          <p style={{ fontSize: '12px', color: '#ff6b6b', textAlign: 'center' }}>{error}</p>
        )}

        {demoMode && (
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Demo building: Drive tokens are kept in memory until the backend restarts.
          </p>
        )}

        <button onClick={connectDrive} className="btn-accent" disabled={!configured}>
          {configured ? 'Connect Drive' : 'OAuth Not Configured'}
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '12px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{files.length} files</span>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={importRecentFiles}
            disabled={importing}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              fontSize: '12px',
              cursor: 'pointer',
              opacity: importing ? 0.5 : 1,
            }}
          >
            {importing ? 'Importing...' : 'Import Recent'}
          </button>
          {!isDriveFolder && (
            <button
              onClick={syncFolder}
              disabled={syncing}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                cursor: 'pointer',
                opacity: syncing ? 0.5 : 1,
              }}
            >
              {syncing ? 'Syncing...' : 'Folder'}
            </button>
          )}
        </div>
      </div>

      {importSummary && (
        <div style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '12px', borderBottom: '1px solid var(--border)' }}>
          Imported {importSummary.imported || 0} files. Skipped {importSummary.skipped || 0} unsupported files.
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 12px', color: '#ff6b6b', fontSize: '12px', borderBottom: '1px solid var(--border)' }}>
          {error}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {files.length === 0 && (
          <div style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
            {isDriveFolder
              ? 'This Drive folder is empty, or it only contains files Google did not return.'
              : 'Drive is connected. Import recent files to read Docs, Sheets, Slides, and text files into this building.'}
          </div>
        )}

        {files.map(file => (
          <div
            key={file.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ fontSize: '11px', color: 'var(--accent)', minWidth: '44px' }}>{getMimeIcon(file.mimeType || file.mime_type)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: '13px',
                color: 'white',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                margin: 0,
              }}>{file.name}</p>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : ''}
              </p>
            </div>
            {file.webViewLink && (
              <a
                href={file.webViewLink}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}
              >
                Open
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
