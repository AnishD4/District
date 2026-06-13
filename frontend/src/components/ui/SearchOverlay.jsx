import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCityStore } from '../../store/cityStore'
import { api } from '../../lib/api'

export function SearchOverlay() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const setSelectedBuilding = useCityStore(s => s.setSelectedBuilding)
  const openPanel = useCityStore(s => s.openPanel)
  const setSearchResults = useCityStore(s => s.setSearchResults)
  const inputRef = useRef()

  // Press / to open
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && !open) { e.preventDefault(); setOpen(true) }
      if (e.key === 'Escape') { setOpen(false); setSearchResults([]) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, setSearchResults])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const search = async (q) => {
    setQuery(q)
    if (!q.trim()) { setResults([]); setSearchResults([]); return }
    setSearching(true)
    try {
      const { results: r } = await api.search(q)
      setResults(r || [])
      setSearchResults((r || []).map(r => r.id))
    } catch {
      setResults([])
    }
    setSearching(false)
  }

  const selectResult = (result) => {
    setSelectedBuilding(result.id)
    openPanel('building')
    setOpen(false)
    setSearchResults([])
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '96px',
            padding: '96px 16px 0',
            zIndex: 50,
            pointerEvents: 'auto',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) { setOpen(false); setSearchResults([]) }
          }}
        >
          <motion.div
            initial={{ scale: 0.95, y: -10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: -10 }}
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '560px',
              borderRadius: '16px',
              overflow: 'hidden',
            }}
          >
            {/* Search input */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ color: 'var(--accent)', fontSize: '18px' }}>✦</span>
              <input
                ref={inputRef}
                value={query}
                onChange={e => search(e.target.value)}
                placeholder="Search your city semantically..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  padding: '16px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              {searching && (
                <div className="animate-spin" style={{
                  width: '16px', height: '16px',
                  border: '2px solid var(--accent)',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                }} />
              )}
            </div>

            {/* Results */}
            {results.length > 0 && (
              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {results.map(r => (
                  <button
                    key={r.id}
                    onClick={() => selectResult(r)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s',
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{
                      width: '32px', height: '32px',
                      borderRadius: '8px',
                      background: 'rgba(108,99,255,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent)',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}>
                      {Math.round(r.similarity * 100)}
                    </div>
                    <div>
                      <p style={{ color: 'white', fontSize: '14px', fontWeight: 500 }}>{r.name}</p>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'capitalize' }}>{r.type}</p>
                    </div>
                    <div style={{
                      marginLeft: 'auto',
                      width: '64px', height: '4px',
                      borderRadius: '2px',
                      background: 'rgba(108,99,255,0.3)',
                    }}>
                      <div style={{
                        height: '100%',
                        background: 'var(--accent)',
                        borderRadius: '2px',
                        width: `${r.similarity * 100}%`,
                      }} />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {query && results.length === 0 && !searching && (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                No matching buildings found
              </div>
            )}

            <div style={{
              padding: '8px 16px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              borderTop: '1px solid var(--border)',
            }}>
              Press <kbd style={{
                background: 'rgba(255,255,255,0.1)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
              }}>Esc</kbd> to close
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
