import { useCityStore } from '../../store/cityStore'

export function CityGround() {
  const districts = useCityStore(s => s.districts)

  return (
    <group>
      {/* Main ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color="#0a0a0c" roughness={0.9} />
      </mesh>

      {/* District zones — subtle colored circles on the ground */}
      {districts.map(d => (
        <mesh key={d.id} rotation={[-Math.PI / 2, 0, 0]} position={[d.position_x, 0.1, d.position_z]}>
          <circleGeometry args={[d.radius, 64]} />
          <meshStandardMaterial color={d.color} transparent opacity={0.08} />
        </mesh>
      ))}
    </group>
  )
}
