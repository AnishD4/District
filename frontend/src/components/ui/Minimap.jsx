import { useRef, useEffect } from 'react'
import { useCityStore } from '../../store/cityStore'

export function Minimap() {
  const canvasRef = useRef()
  const buildings = useCityStore(s => s.buildings)
  const districts = useCityStore(s => s.districts)
  const connections = useCityStore(s => s.connections)
  const selectedBuilding = useCityStore(s => s.selectedBuilding)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = 160, H = 160
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#0d0d0f'
    ctx.fillRect(0, 0, W, H)

    const scale = 0.35, cx = W / 2, cy = H / 2

    // District zones
    districts.forEach(d => {
      ctx.beginPath()
      ctx.arc(cx + d.position_x * scale, cy + d.position_z * scale, d.radius * scale, 0, Math.PI * 2)
      ctx.fillStyle = d.color + '22'
      ctx.fill()
    })

    // Connections
    connections.forEach(c => {
      const a = buildings.find(b => b.id === c.building_a)
      const bldg = buildings.find(b => b.id === c.building_b)
      if (!a || !bldg) return
      ctx.beginPath()
      ctx.moveTo(cx + a.position_x * scale, cy + a.position_z * scale)
      ctx.lineTo(cx + bldg.position_x * scale, cy + bldg.position_z * scale)
      ctx.strokeStyle = `rgba(108,99,255,${(c.strength || 0.5) * 0.8})`
      ctx.lineWidth = (c.strength || 0.5) * 2
      ctx.stroke()
    })

    // Buildings
    buildings.forEach(b => {
      const isSelected = b.id === selectedBuilding
      ctx.beginPath()
      ctx.rect(cx + b.position_x * scale - 3, cy + b.position_z * scale - 3, 6, 6)
      ctx.fillStyle = isSelected ? '#ffffff' : '#6c63ff'
      ctx.fill()
    })
  }, [buildings, districts, connections, selectedBuilding])

  return (
    <div className="glass-panel" style={{ borderRadius: '12px', overflow: 'hidden', width: 160, height: 160 }}>
      <canvas ref={canvasRef} width={160} height={160} style={{ display: 'block' }} />
    </div>
  )
}
