import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { useCityStore } from '../../store/cityStore'

function getBuildingColor(type) {
  return {
    project: '#6c63ff',
    subject: '#4ecdc4',
    personal: '#ff6b6b',
    work: '#ffd93d',
  }[type] || '#6c63ff'
}

function hashString(value = '') {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function randomFrom(seed, index) {
  const value = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453
  return value - Math.floor(value)
}

function getWindowColor(seed, index, active) {
  if (active) {
    return ['#ff8f1f', '#ffb43b', '#ffd36b'][index % 3]
  }
  return ['#ff9d22', '#ffc857', '#ffe28a'][Math.floor(randomFrom(seed, index) * 3)]
}

function shortFileName(name, maxLength = 18) {
  if (!name) return ''
  if (name.length <= maxLength) return name

  const dot = name.lastIndexOf('.')
  const ext = dot > 0 && name.length - dot <= 6 ? name.slice(dot) : ''
  const base = ext ? name.slice(0, dot) : name
  return `${base.slice(0, maxLength - ext.length - 3)}...${ext}`
}

function FacadeWindows({ width, depth, height, seed, active = false }) {
  const floors = Math.max(3, Math.min(18, Math.floor(height / 3)))
  const frontCols = Math.max(3, Math.min(6, Math.floor(width / 2)))
  const sideCols = Math.max(3, Math.min(6, Math.floor(depth / 2)))
  const panes = []
  const yStep = height / (floors + 1)
  const density = active ? 0.76 : 0.66

  const sides = [
    { id: 'front', cols: frontCols, span: width, z: depth / 2 + 0.06, rotation: [0, 0, 0] },
    { id: 'back', cols: frontCols, span: width, z: -depth / 2 - 0.06, rotation: [0, Math.PI, 0] },
    { id: 'right', cols: sideCols, span: depth, x: width / 2 + 0.06, rotation: [0, Math.PI / 2, 0] },
    { id: 'left', cols: sideCols, span: depth, x: -width / 2 - 0.06, rotation: [0, -Math.PI / 2, 0] },
  ]

  for (const side of sides) {
    for (let row = 0; row < floors; row += 1) {
      for (let col = 0; col < side.cols; col += 1) {
        const index = panes.length + row * 17 + col * 31
        if (randomFrom(seed, index) > density) continue

        const offset = ((col + 0.5) / side.cols - 0.5) * (side.span * 0.72)
        const position = side.x === undefined
          ? [offset, (row + 1) * yStep, side.z]
          : [side.x, (row + 1) * yStep, offset]
        const color = getWindowColor(seed, index, active)

        panes.push(
          <mesh key={`${side.id}-${row}-${col}`} position={position} rotation={side.rotation}>
            <planeGeometry args={[1.1, 1.35]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={active ? 1.9 : 1.35}
              transparent
              opacity={0.92}
              toneMapped={false}
            />
          </mesh>
        )
      }
    }
  }

  return panes
}

function CornerStrips({ width, depth, height, color }) {
  const x = width / 2 + 0.08
  const z = depth / 2 + 0.08
  return [
    [x, z],
    [x, -z],
    [-x, z],
    [-x, -z],
  ].map(([px, pz]) => (
    <mesh key={`${px}-${pz}`} position={[px, height / 2, pz]}>
      <boxGeometry args={[0.22, height, 0.22]} />
      <meshBasicMaterial color={color} transparent opacity={0.48} toneMapped={false} />
    </mesh>
  ))
}

function RoofGlow({ width, depth, y, color }) {
  const bars = [
    { key: 'front', position: [0, y, depth / 2 + 0.35], args: [width + 1.2, 0.2, 0.28] },
    { key: 'back', position: [0, y, -depth / 2 - 0.35], args: [width + 1.2, 0.2, 0.28] },
    { key: 'right', position: [width / 2 + 0.35, y, 0], args: [0.28, 0.2, depth + 1.2] },
    { key: 'left', position: [-width / 2 - 0.35, y, 0], args: [0.28, 0.2, depth + 1.2] },
  ]

  return bars.map(bar => (
    <mesh key={bar.key} position={bar.position}>
      <boxGeometry args={bar.args} />
      <meshBasicMaterial color={color} transparent opacity={0.82} toneMapped={false} />
    </mesh>
  ))
}

function Antenna({ height, color }) {
  if (height < 28) return null

  return (
    <group position={[0, height + 3.4, 0]}>
      <mesh position={[0, 2.8, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 5.6, 8]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[0, 5.8, 0]}>
        <sphereGeometry args={[0.5, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} toneMapped={false} />
      </mesh>
    </group>
  )
}

function HighlightBeam({ height, color, visible }) {
  if (!visible) return null

  return (
    <mesh position={[0, height + 34, 0]}>
      <cylinderGeometry args={[8, 5, 68, 24, 1, true]} />
      <meshBasicMaterial color={color} transparent opacity={0.13} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

function FileNamePanels({ width, depth, height, fileNames, loading, accentColor, active }) {
  const visibleNames = fileNames.slice(0, 4)
  const names = loading
    ? ['reading files...']
    : visibleNames.length > 0
      ? visibleNames
      : []

  if (names.length === 0) return null

  const panelWidth = Math.max(7, width * 0.82)
  const startY = Math.min(height - 2, Math.max(5, height * 0.68))
  const rowGap = 2.15
  const panelColor = active ? '#0b2530' : '#050508'
  const textColor = active ? '#f5fdff' : '#ffd36b'

  return (
    <group position={[0, 1.4, depth / 2 + 0.18]}>
      {names.map((name, index) => (
        <group key={`${name}-${index}`} position={[0, startY - index * rowGap, 0]}>
          <mesh>
            <planeGeometry args={[panelWidth, 1.45]} />
            <meshBasicMaterial
              color={panelColor}
              transparent
              opacity={loading ? 0.68 : 0.78}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[-panelWidth / 2 + 0.18, 0, 0.01]}>
            <planeGeometry args={[0.16, 1.25]} />
            <meshBasicMaterial color={accentColor} transparent opacity={0.95} toneMapped={false} />
          </mesh>
          <Text
            position={[0.18, -0.02, 0.04]}
            fontSize={0.64}
            maxWidth={panelWidth - 0.9}
            color={textColor}
            anchorX="center"
            anchorY="middle"
          >
            {shortFileName(name)}
          </Text>
        </group>
      ))}

      {!loading && fileNames.length > visibleNames.length && (
        <Text
          position={[0, startY - names.length * rowGap - 0.3, 0.04]}
          fontSize={0.56}
          color="#8b8a96"
          anchorX="center"
          anchorY="middle"
        >
          {`+${fileNames.length - visibleNames.length} more files`}
        </Text>
      )}
    </group>
  )
}

export function BuildingMesh({ building }) {
  const bodyMaterialRef = useRef()
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

  const accentColor = getBuildingColor(building.type)
  const seed = useMemo(() => hashString(`${building.id}-${building.name}`), [building.id, building.name])
  const style = useMemo(() => {
    const baseHeight = Math.max((building.height || 10) * 1.35, 12)
    const width = 10 + Math.floor(randomFrom(seed, 1) * 4)
    const depth = 10 + Math.floor(randomFrom(seed, 2) * 4)
    const upperHeight = baseHeight > 22 ? Math.max(7, Math.min(18, baseHeight * 0.38)) : 0
    const upperWidth = Math.max(6, width - 3 - Math.floor(randomFrom(seed, 3) * 2))
    const upperDepth = Math.max(6, depth - 3 - Math.floor(randomFrom(seed, 4) * 2))
    const totalHeight = baseHeight + upperHeight

    return { baseHeight, width, depth, upperHeight, upperWidth, upperDepth, totalHeight }
  }, [building.height, seed])

  const isActive = isHovered || isSelected || isSearchMatch
  const bodyColor = isActive ? '#0fd3df' : '#09090d'
  const trimColor = isActive ? '#d7fbff' : accentColor
  const fileNames = Array.isArray(building.file_names) ? building.file_names : []

  useFrame(() => {
    if (!bodyMaterialRef.current) return
    const targetEmissive = isSearchMatch ? 0.55 : (isHovered || isSelected) ? 0.34 : 0.06
    bodyMaterialRef.current.emissiveIntensity +=
      (targetEmissive - bodyMaterialRef.current.emissiveIntensity) * 0.1

    const targetOpacity = isDimmed ? 0.2 : 1
    bodyMaterialRef.current.opacity += (targetOpacity - bodyMaterialRef.current.opacity) * 0.1
  })

  const handleClick = () => {
    setSelectedBuilding(building.id)
    openPanel('building')
  }

  return (
    <group position={[building.position_x, 0, building.position_z]}>
      <mesh
        position={[0, style.totalHeight / 2, 0]}
        onPointerOver={(e) => { e.stopPropagation(); setHoveredBuilding(building.id) }}
        onPointerOut={() => setHoveredBuilding(null)}
        onClick={(e) => { e.stopPropagation(); handleClick() }}
      >
        <boxGeometry args={[style.width + 5, style.totalHeight + 8, style.depth + 5]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <mesh position={[0, 0.7, 0]} receiveShadow>
        <boxGeometry args={[style.width + 3.5, 1.4, style.depth + 3.5]} />
        <meshStandardMaterial color="#050507" roughness={0.7} metalness={0.2} />
      </mesh>

      <mesh position={[0, style.baseHeight / 2 + 1.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[style.width, style.baseHeight, style.depth]} />
        <meshStandardMaterial
          ref={bodyMaterialRef}
          color={bodyColor}
          emissive={bodyColor}
          emissiveIntensity={0.06}
          roughness={0.56}
          metalness={0.28}
          transparent
          opacity={1}
        />
      </mesh>

      <group position={[0, 1.4, 0]}>
        <FacadeWindows
          width={style.width}
          depth={style.depth}
          height={style.baseHeight}
          seed={seed}
          active={isActive}
        />
        <CornerStrips width={style.width} depth={style.depth} height={style.baseHeight} color={trimColor} />
        <RoofGlow width={style.width} depth={style.depth} y={style.baseHeight + 0.25} color={trimColor} />
      </group>

      <FileNamePanels
        width={style.width}
        depth={style.depth}
        height={style.baseHeight}
        fileNames={fileNames}
        loading={Boolean(building.files_loading)}
        accentColor={trimColor}
        active={isActive}
      />

      {style.upperHeight > 0 && (
        <group position={[0, style.baseHeight + 1.4, 0]}>
          <mesh position={[0, style.upperHeight / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[style.upperWidth, style.upperHeight, style.upperDepth]} />
            <meshStandardMaterial
              color={isActive ? '#12b8d4' : '#08080b'}
              emissive={isActive ? '#12b8d4' : accentColor}
              emissiveIntensity={isActive ? 0.28 : 0.05}
              roughness={0.52}
              metalness={0.32}
            />
          </mesh>
          <FacadeWindows
            width={style.upperWidth}
            depth={style.upperDepth}
            height={style.upperHeight}
            seed={seed + 101}
            active={isActive}
          />
          <CornerStrips width={style.upperWidth} depth={style.upperDepth} height={style.upperHeight} color={trimColor} />
          <RoofGlow width={style.upperWidth} depth={style.upperDepth} y={style.upperHeight + 0.25} color={trimColor} />
        </group>
      )}

      <Antenna height={style.totalHeight + 1.4} color={trimColor} />
      <HighlightBeam height={style.totalHeight} color={accentColor} visible={isSelected || isSearchMatch} />

      <Text
        position={[0, style.totalHeight + 7, 0]}
        fontSize={3}
        color={isActive ? '#ffffff' : '#8b8a96'}
        anchorX="center"
        anchorY="middle"
      >
        {building.name}
      </Text>
    </group>
  )
}
