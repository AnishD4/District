import { useCityStore } from '../../store/cityStore'

const TIME_PRESETS = ['dawn', 'day', 'dusk', 'night']

export function Toolbar() {
  const timeOfDay = useCityStore(s => s.timeOfDay)
  const setTimeOfDay = useCityStore(s => s.setTimeOfDay)
  const cameraMode = useCityStore(s => s.cameraMode)
  const setCameraMode = useCityStore(s => s.setCameraMode)

  const toggleDriveMode = () => {
    setCameraMode(cameraMode === 'drive' ? 'orbit' : 'drive')
  }

  return (
    <div className="glass-panel" style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      borderRadius: '16px',
      padding: '8px 16px',
    }}>
      {/* Time of day buttons */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {TIME_PRESETS.map(preset => (
          <button
            key={preset}
            onClick={() => setTimeOfDay(preset)}
            style={{
              padding: '4px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 500,
              textTransform: 'capitalize',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: timeOfDay === preset ? 'var(--accent)' : 'transparent',
              color: timeOfDay === preset ? 'white' : 'var(--text-secondary)',
            }}
          >
            {preset}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />

      {/* Search hint */}
      <button
        onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }))}
        style={{
          padding: '4px 12px',
          borderRadius: '8px',
          fontSize: '12px',
          border: '1px solid var(--border)',
          background: 'transparent',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span>✦</span> Search
        <kbd style={{
          background: 'rgba(255,255,255,0.1)',
          padding: '1px 6px',
          borderRadius: '4px',
          fontSize: '10px'
        }}>/</kbd>
      </button>

      {/* Divider */}
      <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />

      {/* Drive mode */}
      <button
        onClick={toggleDriveMode}
        style={{
          padding: '6px 16px',
          borderRadius: '12px',
          fontSize: '13px',
          fontWeight: 500,
          border: cameraMode === 'drive' ? 'none' : '1px solid var(--border)',
          background: cameraMode === 'drive' ? 'var(--accent)' : 'transparent',
          color: cameraMode === 'drive' ? 'white' : 'var(--text-secondary)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        {cameraMode === 'drive' ? '← Exit Drive Mode' : '🚗 Take a Break'}
      </button>
    </div>
  )
}
