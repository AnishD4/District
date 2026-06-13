import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useCityStore } from '../../store/cityStore'
import { api } from '../../lib/api'
import { ChatPanel } from './ChatPanel'
import { DrivePanel } from './DrivePanel'

export function BuildingPanel() {
  const selectedBuilding = useCityStore(s => s.selectedBuilding)
  const closePanel = useCityStore(s => s.closePanel)
  const [building, setBuilding] = useState(null)
  const [activeTab, setActiveTab] = useState('files')

  useEffect(() => {
    if (!selectedBuilding) return
    api.getBuilding(selectedBuilding).then(setBuilding).catch(console.error)
  }, [selectedBuilding])

  if (!building) return null

  return (
    <motion.div
      initial={{ x: 400 }}
      animate={{ x: 0 }}
      exit={{ x: 400 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{
        height: '100%',
        width: '384px',
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: 'white',
              fontFamily: "'Space Grotesk', sans-serif",
              margin: 0,
            }}>{building.name}</h2>
            <p style={{
              fontSize: '13px',
              color: 'var(--text-secondary)',
              marginTop: '2px',
            }}>
              {building.file_count || 0} files · {building.type}
            </p>
          </div>
          <button
            onClick={() => closePanel('building')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px',
              lineHeight: 1,
            }}
          >×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          {['files', 'chat'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '6px 0',
                fontSize: '13px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.2s',
                background: activeTab === tab ? 'var(--accent)' : 'transparent',
                color: activeTab === tab ? 'white' : 'var(--text-secondary)',
              }}
            >
              {tab === 'chat' ? '✦ AI Resident' : '📁 Files'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'files' && <DrivePanel building={building} />}
        {activeTab === 'chat' && <ChatPanel building={building} />}
      </div>
    </motion.div>
  )
}
