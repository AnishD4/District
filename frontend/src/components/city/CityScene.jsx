import { Sky } from '@react-three/drei'
import { BuildingMesh } from './BuildingMesh'
import { BuildingSkeletons } from './BuildingSkeletons'
import { ConnectionBridge } from './ConnectionBridge'
import { CityGround } from './CityGround'
import { CityLighting } from './CityLighting'
import { CameraController } from './CameraController'
import { CityParticles } from './CityParticles'
import { useCityStore } from '../../store/cityStore'

function timeOfDayToSunPos(preset) {
  const positions = {
    dawn:     [0.1, 0.05, -1],
    day:      [0, 1, 0],
    dusk:     [-0.1, 0.08, 1],
    night:    [0, -1, 0],
    overcast: [0, 0.5, 0],
  }
  return positions[preset] || positions.night
}

export function CityScene() {
  const buildings = useCityStore(s => s.buildings)
  const connections = useCityStore(s => s.connections)
  const timeOfDay = useCityStore(s => s.timeOfDay)

  return (
    <>
      <CityLighting timeOfDay={timeOfDay} />
      <CityGround />
      <Sky sunPosition={timeOfDayToSunPos(timeOfDay)} turbidity={8} rayleigh={2} />

      {/* Buildings */}
      {buildings.length === 0
        ? <BuildingSkeletons />
        : buildings.map(b => <BuildingMesh key={b.id} building={b} />)
      }

      {/* Skybridges */}
      {connections.map((c, i) => (
        <ConnectionBridge key={`${c.building_a}-${c.building_b}`} connection={c} buildings={buildings} />
      ))}

      {/* Ambient particles */}
      <CityParticles />

      <CameraController />
    </>
  )
}
