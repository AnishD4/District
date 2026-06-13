import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCityStore } from '../../store/cityStore'

const TIME_CONFIGS = {
  dawn:     { ambient: '#ff9966', ambientIntensity: 0.3, sunColor: '#ffcc88', sunPos: [50, 20, 0] },
  day:      { ambient: '#ffffff', ambientIntensity: 0.6, sunColor: '#ffffff', sunPos: [50, 150, 50] },
  dusk:     { ambient: '#cc5533', ambientIntensity: 0.3, sunColor: '#ff8844', sunPos: [-50, 15, 0] },
  night:    { ambient: '#112244', ambientIntensity: 0.15, sunColor: '#aabbff', sunPos: [0, -100, 50] },
  overcast: { ambient: '#aaaaaa', ambientIntensity: 0.5, sunColor: '#cccccc', sunPos: [0, 100, 0] },
}

function SpotlightController() {
  const spotRef = useRef()
  const hoveredBuilding = useCityStore(s => s.hoveredBuilding)
  const buildings = useCityStore(s => s.buildings)

  useFrame(() => {
    if (!spotRef.current) return
    const hovered = buildings.find(b => b.id === hoveredBuilding)
    const tx = hovered ? hovered.position_x : 0
    const tz = hovered ? hovered.position_z : 0
    const ty = hovered ? hovered.height : 0

    spotRef.current.target.position.x += (tx - spotRef.current.target.position.x) * 0.1
    spotRef.current.target.position.y += (ty - spotRef.current.target.position.y) * 0.1
    spotRef.current.target.position.z += (tz - spotRef.current.target.position.z) * 0.1
    spotRef.current.target.updateMatrixWorld()
    spotRef.current.intensity += ((hovered ? 3 : 0) - spotRef.current.intensity) * 0.08
  })

  return (
    <spotLight
      ref={spotRef}
      position={[0, 200, 0]}
      color="#ffffff"
      intensity={0}
      angle={0.15}
      penumbra={0.5}
      castShadow={false}
    />
  )
}

export function CityLighting({ timeOfDay }) {
  const config = TIME_CONFIGS[timeOfDay] || TIME_CONFIGS.night

  return (
    <>
      <ambientLight color={config.ambient} intensity={config.ambientIntensity} />
      <directionalLight
        position={config.sunPos}
        color={config.sunColor}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={500}
        shadow-camera-left={-200}
        shadow-camera-right={200}
        shadow-camera-top={200}
        shadow-camera-bottom={-200}
      />
      <SpotlightController />
    </>
  )
}
