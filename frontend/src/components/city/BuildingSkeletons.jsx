export function BuildingSkeletons() {
  return Array.from({ length: 8 }).map((_, i) => (
    <mesh key={i} position={[Math.sin(i * 0.8) * 80, 10, Math.cos(i * 0.8) * 80]}>
      <boxGeometry args={[12, 20, 12]} />
      <meshStandardMaterial color="#16161a" wireframe />
    </mesh>
  ))
}
