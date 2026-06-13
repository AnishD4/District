import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import plotsData from '../data/plots.json';
import { createPlotShape, getBuildingHeight } from '../lib/plotUtils';

const BUILDING_PALETTE = [
  { color: '#8ea4b8', emissive: '#1a2530', metalness: 0.55, roughness: 0.35 },
  { color: '#b8c4ce', emissive: '#202830', metalness: 0.35, roughness: 0.45 },
  { color: '#6a8fa8', emissive: '#152535', metalness: 0.65, roughness: 0.28 },
  { color: '#a69888', emissive: '#2a2520', metalness: 0.3, roughness: 0.5 },
  { color: '#7d9199', emissive: '#182428', metalness: 0.5, roughness: 0.4 },
  { color: '#9aabb8', emissive: '#1e2830', metalness: 0.45, roughness: 0.38 },
];

function BaseMap({ scene }) {
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  return <primitive object={clonedScene} />;
}

function PlotBuilding({ plot, index }) {
  const { shape, height, palette } = useMemo(() => ({
    shape: createPlotShape(plot),
    height: getBuildingHeight(index, plot),
    palette: BUILDING_PALETTE[index % BUILDING_PALETTE.length],
  }), [plot, index]);

  const extrudeSettings = useMemo(() => ({
    depth: height,
    bevelEnabled: true,
    bevelThickness: 0.4,
    bevelSize: 0.4,
    bevelSegments: 1,
  }), [height]);

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.08, 0]}
        castShadow
        receiveShadow
      >
        <extrudeGeometry args={[shape, extrudeSettings]} />
        <meshStandardMaterial
          color={palette.color}
          emissive={palette.emissive}
          emissiveIntensity={0.08}
          metalness={palette.metalness}
          roughness={palette.roughness}
        />
      </mesh>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, height + 0.12, 0]}
        castShadow
      >
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial color="#1a2030" roughness={0.65} metalness={0.25} />
      </mesh>
    </group>
  );
}

export default function CityScene() {
  const { scene } = useGLTF('/city_infrastructure_base_map.glb');

  return (
    <group>
      <BaseMap scene={scene} />

      {plotsData.map((plot, index) => (
        <PlotBuilding key={index} plot={plot} index={index} />
      ))}
    </group>
  );
}

useGLTF.preload('/city_infrastructure_base_map.glb');
