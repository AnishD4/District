import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CITY_CENTER } from '../../lib/plotUtils';

const [centerX, , centerZ] = CITY_CENTER;

export function NightStars() {
  const groupRef = useRef();

    const { positions, sizes } = useMemo(() => {
    const count = 2500;
    const pos = new Float32Array(count * 3);
    const sz = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const radius = 800 + Math.random() * 1200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.45 + 0.05;

      pos[i * 3] = centerX + radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = 80 + radius * Math.cos(phi) * 0.6;
      pos[i * 3 + 2] = centerZ + radius * Math.sin(phi) * Math.sin(theta);

      sz[i] = 0.4 + Math.random() * 1.8;
    }

    return { positions: pos, sizes: sz };
  }, []);

  const materialRef = useRef();

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.opacity = 0.55 + Math.sin(clock.elapsedTime * 0.3) * 0.08;
    }
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.elapsedTime * 0.002;
    }
  });

  return (
    <group ref={groupRef}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
        </bufferGeometry>
        <pointsMaterial
          ref={materialRef}
          color="#e8eeff"
          size={1.2}
          transparent
          opacity={0.65}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Moon */}
      <mesh position={[centerX + 400, 320, centerZ - 500]}>
        <sphereGeometry args={[18, 32, 32]} />
        <meshBasicMaterial color="#e8ecf8" />
      </mesh>
      <mesh position={[centerX + 400, 320, centerZ - 500]}>
        <sphereGeometry args={[28, 32, 32]} />
        <meshBasicMaterial color="#8899cc" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}
