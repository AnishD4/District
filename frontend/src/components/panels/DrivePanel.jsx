import { useEffect, useState } from 'react'
import { api } from '../../lib/api'

function getMimeIcon(mimeType) {
  if (mimeType?.includes('document')) return '📄'
  if (mimeType?.includes('spreadsheet')) return '📊'
  if (mimeType?.includes('presentation')) return '📑'
  if (mimeType?.includes('pdf')) return '📕'
  if (mimeType?.includes('image')) return '🖼️'
  return '📎'
}

export function DrivePanel({ building }) {
  const [files, setFiles] = useState([])
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    api.getDriveFiles(building.id)
      .then(({ files, connected }) => {
        setFiles(files || [])
        setConnected(connected)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [building.id])

  const connectDrive = () => {
    window.location.href = `/api/drive/auth?building_id=${building.id}`
  }

  const syncFolder = async () => {
    const folderId = prompt('Paste a Google Drive folder ID (from the URL):')
    if (!folderId) return
    setSyncing(true)
    await api.syncDrive(building.id, folderId)
    const { files: f } = await api.getDriveFiles(building.id)
    setFiles(f || [])
    setSyncing(false)
    // Trigger embedding update in background
    api.embed(building.id)
  }

  if (loading) {
    return (
      <div style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
        Loading files...
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
        <div style={{ fontSize: '32px' }}>📁</div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>
          Connect Google Drive to populate this building with your files.
        </p>
        <button onClick={connectDrive} className="btn-accent">
          Connect Drive
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '12px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{files.length} files</span>
        <button
          onClick={syncFolder}
          disabled={syncing}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent)',
            fontSize: '12px',
            cursor: 'pointer',
            opacity: syncing ? 0.5 : 1,
          }}
        >
          {syncing ? 'Syncing...' : '⟳ Sync Folder'}
        </button>
      </div>

      {/* File list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
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
            <span style={{ fontSize: '16px' }}>{getMimeIcon(file.mimeType)}</span>
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
                Open ↗
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
