import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { CITY_CENTER, getCameraDistanceLimits, getTerrainDimensions } from '../../lib/plotUtils';

const [centerX, , centerZ] = CITY_CENTER;

export function TerrainBase() {
  const { size } = useThree();
  const aspect = size.width / size.height;
  const { maxDistance } = useMemo(() => getCameraDistanceLimits(aspect), [aspect]);
  const { width, depth } = useMemo(
    () => getTerrainDimensions(maxDistance, aspect),
    [maxDistance, aspect],
  );

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, -0.06, centerZ]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial color="#1a2218" roughness={0.96} metalness={0.02} />
    </mesh>
  );
}
