import { Minimap } from './Minimap'
import { SearchOverlay } from './SearchOverlay'
import { Toolbar } from './Toolbar'
import { BuildingPanel } from '../panels/BuildingPanel'
import { useCityStore } from '../../store/cityStore'
import { api } from '../../lib/api'

export function UIOverlay() {
  const activePanels = useCityStore(s => s.activePanels)
  const cameraMode = useCityStore(s => s.cameraMode)
  const addBuilding = useCityStore(s => s.addBuilding)

  const handleAddBuilding = async () => {
    const name = prompt('Building name:')
    if (!name) return
    try {
      const b = await api.createBuilding({
        name,
        type: 'project',
        position_x: Math.random() * 100 - 50,
        position_z: Math.random() * 100 - 50,
        height: 15
      })
      addBuilding(b)
    } catch (err) {
      console.error('Failed to create building:', err)
    }
  }

  if (cameraMode === 'drive') {
    return (
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute',
          bottom: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          pointerEvents: 'auto'
        }}>
          <div className="glass-panel" style={{
            borderRadius: '16px',
            padding: '12px 20px',
            textAlign: 'center'
          }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
              WASD to drive · Mouse to look · B or Esc to exit
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* Top toolbar */}
      <div style={{
        pointerEvents: 'auto',
        position: 'absolute',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10
      }}>
        <Toolbar />
      </div>

      {/* Minimap — bottom right */}
      <div style={{
        pointerEvents: 'auto',
        position: 'absolute',
        bottom: '16px',
        right: '16px',
        zIndex: 10
      }}>
        <Minimap />
      </div>

      {/* Add building button — bottom left */}
      <button
        onClick={handleAddBuilding}
        className="btn-accent"
        style={{
          pointerEvents: 'auto',
          position: 'absolute',
          bottom: '80px',
          right: '16px',
          width: '48px',
          height: '48px',
          borderRadius: '16px',
          fontSize: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(108, 99, 255, 0.3)',
          zIndex: 10,
          padding: 0,
        }}
      >
        +
      </button>

      {/* Right-side panels */}
      {activePanels.includes('building') && (
        <div style={{
          pointerEvents: 'auto',
          position: 'absolute',
          top: 0,
          right: 0,
          height: '100%',
          zIndex: 20
        }}>
          <BuildingPanel />
        </div>
      )}

      {/* Search overlay (fullscreen) */}
      <SearchOverlay />
    </div>
  )
}
