import { useMemo } from 'react'
import { CatmullRomCurve3, Vector3 } from 'three'

export function ConnectionBridge({ connection, buildings }) {
  const buildingA = buildings.find(b => b.id === connection.building_a)
  const buildingB = buildings.find(b => b.id === connection.building_b)
  if (!buildingA || !buildingB) return null

  const curve = useMemo(() => {
    const aPos = new Vector3(buildingA.position_x, buildingA.height || 10, buildingA.position_z)
    const bPos = new Vector3(buildingB.position_x, buildingB.height || 10, buildingB.position_z)
    const mid = aPos.clone().lerp(bPos, 0.5)
    mid.y += 30 // arc upward
    return new CatmullRomCurve3([aPos, mid, bPos])
  }, [buildingA, buildingB])

  const tubeWidth = (connection.strength || 0.5) * 2 + 0.5

  return (
    <mesh>
      <tubeGeometry args={[curve, 32, tubeWidth, 8, false]} />
      <meshStandardMaterial
        color="#6c63ff"
        emissive="#6c63ff"
        emissiveIntensity={0.4}
        transparent
        opacity={0.6}
      />
    </mesh>
  )
}
