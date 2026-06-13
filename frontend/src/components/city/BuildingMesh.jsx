import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { useCityStore } from '../../store/cityStore'

function getBuildingColor(type) {
  return {
    project: '#6c63ff',
    subject: '#4ecdc4',
    personal: '#ff6b6b',
    work: '#ffd93d'
  }[type] || '#6c63ff'
}

function WindowPanes({ height }) {
  const rows = Math.floor(height / 4)
  return Array.from({ length: rows }).map((_, i) => (
    <mesh key={i} position={[6.01, i * 4 + 2, 0]}>
      <planeGeometry args={[2, 1.5]} />
      <meshStandardMaterial emissive="#ffcc88" emissiveIntensity={0.8} transparent opacity={0.9} />
    </mesh>
  ))
}

export function BuildingMesh({ building }) {
  const meshRef = useRef()
  const hoveredBuilding = useCityStore(s => s.hoveredBuilding)
  const selectedBuilding = useCityStore(s => s.selectedBuilding)
  const searchResults = useCityStore(s => s.searchResults)
  const setHoveredBuilding = useCityStore(s => s.setHoveredBuilding)
  const setSelectedBuilding = useCityStore(s => s.setSelectedBuilding)
  const openPanel = useCityStore(s => s.openPanel)

  const isHovered = hoveredBuilding === building.id
  const isSelected = selectedBuilding === building.id
  const isSearchMatch = searchResults.length > 0 && searchResults.includes(building.id)
  const isDimmed = searchResults.length > 0 && !searchResults.includes(building.id)

  const height = Math.max(building.height || 10, 5)
  const color = getBuildingColor(building.type)

  // Animate emissive glow on hover/selection/search
  useFrame(() => {
    if (!meshRef.current) return
    const targetEmissive = isSearchMatch ? 0.6 : (isHovered || isSelected) ? 0.3 : 0.0
    meshRef.current.material.emissiveIntensity +=
      (targetEmissive - meshRef.current.material.emissiveIntensity) * 0.1

    const targetOpacity = isDimmed ? 0.2 : 1
    meshRef.current.material.opacity += (targetOpacity - meshRef.current.material.opacity) * 0.1
  })

  const handleClick = () => {
    setSelectedBuilding(building.id)
    openPanel('building')
  }

  return (
    <group position={[building.position_x, 0, building.position_z]}>
      <mesh
        ref={meshRef}
        position={[0, height / 2, 0]}
        castShadow
        receiveShadow
        onPointerOver={(e) => { e.stopPropagation(); setHoveredBuilding(building.id) }}
        onPointerOut={() => setHoveredBuilding(null)}
        onClick={(e) => { e.stopPropagation(); handleClick() }}
      >
        <boxGeometry args={[12, height, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0}
          roughness={0.4}
          metalness={0.6}
          transparent
          opacity={1}
        />
      </mesh>

      {/* Window glow planes */}
      <WindowPanes height={height} />

      {/* Name label — always faces camera */}
      <Text
        position={[0, height + 4, 0]}
        fontSize={3}
        color={isHovered || isSelected ? '#ffffff' : '#8b8a96'}
        anchorX="center"
        anchorY="middle"
      >
        {building.name}
      </Text>
    </group>
  )
}
