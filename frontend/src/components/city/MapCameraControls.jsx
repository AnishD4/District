import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { CITY_CENTER, getCameraDistanceLimits, getPanBounds } from '../../lib/plotUtils';

const [centerX, , centerZ] = CITY_CENTER;

export function MapCameraControls() {
  const controlsRef = useRef(null);
  const { size } = useThree();
  const aspect = size.width / size.height;
  const { minDistance, maxDistance } = useMemo(
    () => getCameraDistanceLimits(aspect),
    [aspect],
  );
  const panBounds = useMemo(() => getPanBounds(), []);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    controls.target.x = THREE.MathUtils.clamp(controls.target.x, panBounds.minX, panBounds.maxX);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, panBounds.minZ, panBounds.maxZ);
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      target={[centerX, 0, centerZ]}
      enableDamping
      dampingFactor={0.08}
      minDistance={minDistance}
      maxDistance={maxDistance}
      maxPolarAngle={Math.PI / 2.05}
    />
  );
}
