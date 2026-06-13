import { useMemo } from 'react'

export function CityParticles() {
  const positions = useMemo(() => {
    const arr = new Float32Array(3000)
    for (let i = 0; i < 3000; i += 3) {
      arr[i] = (Math.random() - 0.5) * 400
      arr[i + 1] = Math.random() * 150
      arr[i + 2] = (Math.random() - 0.5) * 400
    }
    return arr
  }, [])

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.3} transparent opacity={0.3} sizeAttenuation />
    </points>
  )
}
