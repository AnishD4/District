import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Billboard, Text, useGLTF } from '@react-three/drei';
import plotsData from '../data/plots.json';
import { createPlotShape, getBuildingHeight } from '../lib/plotUtils';
import { useCityStore } from '../store/cityStore';
import { CarDriver } from './city/CarDriver';

const BUILDING_PALETTE = [
  { color: '#090b11', trim: '#6c63ff', window: '#ffb43b', emissive: '#15132f', metalness: 0.56, roughness: 0.34 },
  { color: '#080d12', trim: '#4ecdc4', window: '#ffd36b', emissive: '#102a2a', metalness: 0.5, roughness: 0.38 },
  { color: '#0a0a10', trim: '#ff6b6b', window: '#ff9d22', emissive: '#301316', metalness: 0.48, roughness: 0.42 },
  { color: '#0c0b0f', trim: '#ffd93d', window: '#ffe28a', emissive: '#2a2510', metalness: 0.44, roughness: 0.4 },
  { color: '#070b10', trim: '#28b7ff', window: '#ffc857', emissive: '#0f2233', metalness: 0.62, roughness: 0.32 },
  { color: '#08090d', trim: '#b48cff', window: '#ffbf4d', emissive: '#211735', metalness: 0.5, roughness: 0.36 },
];

function BaseMap({ scene, onReady }) {
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

  useEffect(() => {
    onReady?.(clonedScene);
  }, [clonedScene, onReady]);

  return <primitive object={clonedScene} />;
}

function getPlotMetrics(plot) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const [x, , z] of plot) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }

  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const edges = plot.map((point, index) => {
    const next = plot[(index + 1) % plot.length];
    const dx = next[0] - point[0];
    const dz = next[2] - point[2];
    const length = Math.max(1, Math.hypot(dx, dz));
    const candidateNormal = [-dz / length, dx / length];
    const edgeCenterX = (point[0] + next[0]) / 2;
    const edgeCenterZ = (point[2] + next[2]) / 2;
    const awayX = edgeCenterX - centerX;
    const awayZ = edgeCenterZ - centerZ;
    const normalSign = candidateNormal[0] * awayX + candidateNormal[1] * awayZ >= 0 ? 1 : -1;
    const normal = [
      candidateNormal[0] * normalSign,
      candidateNormal[1] * normalSign,
    ];

    return {
      start: point,
      end: next,
      centerX: edgeCenterX,
      centerZ: edgeCenterZ,
      length,
      angle: Math.atan2(-dz, dx) + (normalSign > 0 ? 0 : Math.PI),
      normalX: normal[0],
      normalZ: normal[1],
    };
  });

  return {
    minX,
    maxX,
    minZ,
    maxZ,
    centerX,
    centerZ,
    width: Math.max(1, maxX - minX),
    depth: Math.max(1, maxZ - minZ),
    edges,
  };
}

function shortFileName(name, maxLength = 22) {
  if (!name) return '';
  if (name.length <= maxLength) return name;

  const dot = name.lastIndexOf('.');
  const ext = dot > 0 && name.length - dot <= 6 ? name.slice(dot) : '';
  const base = ext ? name.slice(0, dot) : name;
  return `${base.slice(0, maxLength - ext.length - 3)}...${ext}`;
}

function getFileNames(building) {
  return Array.isArray(building?.file_names) ? building.file_names : [];
}

function getFileRooms(building) {
  if (Array.isArray(building?.file_rooms)) return building.file_rooms;
  return getFileNames(building).map((name, index) => ({
    id: `${name}-${index}`,
    name,
    type: 'file',
    url: null,
  }));
}

function getRoomKind(room) {
  if (room?.type?.includes('folder')) return 'Folder';
  if (room?.type?.includes('document')) return 'Doc';
  if (room?.type?.includes('spreadsheet')) return 'Sheet';
  if (room?.type?.includes('presentation')) return 'Slides';
  if (room?.type?.includes('pdf')) return 'PDF';
  return 'File';
}

function EdgePlane({ edge, y, offset = 1.15, children }) {
  return (
    <group
      position={[
        edge.centerX + edge.normalX * offset,
        y,
        edge.centerZ + edge.normalZ * offset,
      ]}
      rotation={[0, edge.angle, 0]}
    >
      {children}
    </group>
  );
}

function createFacadeCanvas(edgeLength, height, palette, selected) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = selected ? 'rgba(6, 8, 13, 0.72)' : 'rgba(4, 6, 10, 0.56)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cols = Math.max(4, Math.min(16, Math.floor(edgeLength / 7)));
  const rows = Math.max(4, Math.min(selected ? 11 : 8, Math.floor(height / 8)));
  const marginX = 28;
  const marginY = 36;
  const cellW = (canvas.width - marginX * 2) / cols;
  const cellH = (canvas.height - marginY * 2) / rows;
  const windowW = Math.max(7, Math.min(18, cellW * 0.46));
  const windowH = Math.max(9, Math.min(22, cellH * 0.38));

  ctx.shadowColor = palette.window;
  ctx.shadowBlur = selected ? 16 : 10;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if ((row * 7 + col * 11) % 6 === 1) continue;

      const x = marginX + col * cellW + (cellW - windowW) / 2;
      const y = marginY + row * cellH + (cellH - windowH) / 2;
      ctx.fillStyle = (row + col) % 3 === 0 ? palette.trim : palette.window;
      ctx.globalAlpha = selected ? 0.95 : 0.78;
      ctx.fillRect(x, y, windowW, windowH);
    }
  }

  ctx.globalAlpha = selected ? 0.58 : 0.42;
  ctx.shadowBlur = selected ? 18 : 10;
  ctx.fillStyle = palette.trim;
  ctx.fillRect(20, 14, canvas.width - 40, 4);
  ctx.fillRect(20, canvas.height - 18, canvas.width - 40, 4);
  ctx.globalAlpha = 1;

  return canvas;
}

function FacadeTextureFace({ edge, height, palette, selected }) {
  const texture = useMemo(() => {
    const nextTexture = new THREE.CanvasTexture(createFacadeCanvas(edge.length, height, palette, selected));
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.minFilter = THREE.LinearFilter;
    nextTexture.magFilter = THREE.LinearFilter;
    nextTexture.needsUpdate = true;
    return nextTexture;
  }, [edge.length, height, palette, selected]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <EdgePlane edge={edge} y={height / 2} offset={1.22}>
      <mesh position={[0, 0, 0.04]}>
        <planeGeometry args={[edge.length * 0.96, height * 0.92]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={selected ? 0.96 : 0.84}
          toneMapped={false}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </EdgePlane>
  );
}

function FacadeTexture({ metrics, height, palette, selected }) {
  const edgeLimit = selected ? metrics.edges.length : Math.min(4, metrics.edges.length);
  const edges = metrics.edges
    .filter(edge => edge.length > 10)
    .sort((a, b) => b.length - a.length)
    .slice(0, edgeLimit);

  return (
    <>
      {edges.map((edge, edgeIndex) => (
        <FacadeTextureFace
          key={`edge-${edgeIndex}`}
          edge={edge}
          height={height}
          palette={palette}
          selected={selected}
        />
      ))}
    </>
  );
}

function FileNamePanels({ metrics, height, building, palette, selected }) {
  const rooms = building?.files_loading && selected
    ? [{ id: 'loading', name: 'reading files...', type: 'folder' }]
    : getFileRooms(building).slice(0, selected ? 8 : 2);

  if (rooms.length === 0) return null;

  const usableEdges = metrics.edges
    .filter(edge => edge.length > 18)
    .sort((a, b) => b.length - a.length)
    .slice(0, Math.max(1, Math.min(4, metrics.edges.length)));
  const fallbackEdge = usableEdges[0] || metrics.edges[0];

  if (!fallbackEdge) return null;

  if (!selected) {
    const edge = fallbackEdge;
    const panelWidth = Math.max(24, Math.min(58, edge.length * 0.46));
    const y = Math.min(height - 7, Math.max(11, height * 0.62));

    return (
      <EdgePlane edge={edge} y={y} offset={1.35}>
        {rooms.map((room, index) => (
          <group key={room.id || `${room.name}-${index}`} position={[0, -index * 4.8, 0]}>
            <mesh>
              <planeGeometry args={[panelWidth, 3.55]} />
              <meshBasicMaterial color="#050608" transparent opacity={0.82} toneMapped={false} side={2} />
            </mesh>
            <mesh position={[-panelWidth / 2 + 1.1, 0, 0.04]}>
              <planeGeometry args={[0.52, 2.85]} />
              <meshBasicMaterial color={palette.trim} transparent opacity={0.9} toneMapped={false} side={2} />
            </mesh>
            <Text
              position={[-panelWidth / 2 + 4.4, -0.04, 0.1]}
              fontSize={1.32}
              maxWidth={panelWidth - 6}
              color="#ffd36b"
              anchorX="left"
              anchorY="middle"
            >
              {shortFileName(room.name)}
            </Text>
          </group>
        ))}
      </EdgePlane>
    );
  }

  return (
    <>
      {rooms.map((room, roomIndex) => {
        const edge = usableEdges[roomIndex % usableEdges.length] || fallbackEdge;
        const row = Math.floor(roomIndex / usableEdges.length);
        const columnOffset = ((roomIndex % usableEdges.length) % 2 === 0 ? -0.18 : 0.18) * edge.length;
        const panelWidth = Math.max(28, Math.min(76, edge.length * 0.56));
        const y = Math.min(height - 7, Math.max(12, height * 0.72 - row * 6.2));

        return (
          <EdgePlane key={room.id || `${room.name}-${roomIndex}`} edge={edge} y={y} offset={1.45}>
            <group position={[columnOffset, 0, 0]}>
              <mesh>
                <planeGeometry args={[panelWidth, 4.25]} />
                <meshBasicMaterial
                  color="#050608"
                  transparent
                  opacity={building?.files_loading ? 0.72 : 0.86}
                  toneMapped={false}
                  side={2}
                />
              </mesh>
              <mesh position={[-panelWidth / 2 + 1.3, 0, 0.04]}>
                <planeGeometry args={[0.65, 3.55]} />
                <meshBasicMaterial color={palette.trim} transparent opacity={0.95} toneMapped={false} side={2} />
              </mesh>
              <Text
                position={[-panelWidth / 2 + 5.5, 0.9, 0.1]}
                fontSize={1.2}
                maxWidth={panelWidth - 7}
                color="#9fb3c8"
                anchorX="left"
                anchorY="middle"
              >
                {getRoomKind(room)}
              </Text>
              <Text
                position={[-panelWidth / 2 + 5.5, -0.85, 0.1]}
                fontSize={1.55}
                maxWidth={panelWidth - 7}
                color={building?.files_loading ? '#9fb3c8' : '#ffd36b'}
                anchorX="left"
                anchorY="middle"
              >
                {shortFileName(room.name)}
              </Text>
            </group>
          </EdgePlane>
        );
      })}
    </>
  );
}

function RoofTrim({ shape, height, palette }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, height + 0.34, 0]}>
      <shapeGeometry args={[shape]} />
      <meshBasicMaterial color={palette.trim} transparent opacity={0.22} wireframe toneMapped={false} />
    </mesh>
  );
}

function PlotLabel({ metrics, height, building, index }) {
  const label = building?.name || `Plot ${index + 1}`;

  return (
    <Billboard position={[metrics.centerX, height + 12, metrics.centerZ]} follow>
      <Text
        fontSize={4.2}
        maxWidth={90}
        color="#f5fbff"
        outlineColor="#07111f"
        outlineWidth={0.22}
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </Billboard>
  );
}

function BuildingSpotlight({ metrics, height, palette }) {
  const lightRef = useRef(null);
  const targetRef = useRef(null);
  const radius = Math.max(20, Math.min(72, Math.max(metrics.width, metrics.depth) * 0.58));

  useEffect(() => {
    if (lightRef.current && targetRef.current) {
      lightRef.current.target = targetRef.current;
    }
  }, []);

  return (
    <group>
      <object3D ref={targetRef} position={[metrics.centerX, Math.max(8, height * 0.35), metrics.centerZ]} />
      <spotLight
        ref={lightRef}
        position={[metrics.centerX, height + 105, metrics.centerZ + 28]}
        color={palette.window}
        intensity={18}
        distance={230}
        angle={0.42}
        penumbra={0.5}
        decay={1.35}
        castShadow
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[metrics.centerX, 0.22, metrics.centerZ]}>
        <ringGeometry args={[radius * 0.62, radius, 80]} />
        <meshBasicMaterial color={palette.window} transparent opacity={0.45} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function PlotBuilding({ plot, index, building }) {
  const setSelectedBuilding = useCityStore(s => s.setSelectedBuilding);
  const setSelectedPlotIndex = useCityStore(s => s.setSelectedPlotIndex);
  const selectedPlotIndex = useCityStore(s => s.selectedPlotIndex);
  const searchResults = useCityStore(s => s.searchResults);
  const { shape, height, palette, metrics } = useMemo(() => ({
    shape: createPlotShape(plot),
    height: getBuildingHeight(index, plot),
    palette: BUILDING_PALETTE[index % BUILDING_PALETTE.length],
    metrics: getPlotMetrics(plot),
  }), [plot, index]);

  const extrudeSettings = useMemo(() => ({
    depth: height,
    bevelEnabled: true,
    bevelThickness: 0.4,
    bevelSize: 0.4,
    bevelSegments: 1,
  }), [height]);

  if (!building) return null;

  const isSelected = selectedPlotIndex === index;
  const isSearchMatch = searchResults.includes(building.id);

  const handleSelect = (event) => {
    event.stopPropagation();
    setSelectedPlotIndex(index);
    setSelectedBuilding(building?.id || null);
  };

  return (
    <group
      onClick={handleSelect}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
      }}
    >
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.08, 0]}
        castShadow
        receiveShadow
      >
        <extrudeGeometry args={[shape, extrudeSettings]} />
        <meshStandardMaterial
          color={palette.color}
          emissive={isSelected || isSearchMatch ? palette.trim : palette.emissive}
          emissiveIntensity={isSearchMatch ? 0.85 : isSelected ? 0.5 : 0.18}
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
        <meshStandardMaterial
          color="#07090f"
          emissive={palette.trim}
          emissiveIntensity={0.06}
          roughness={0.65}
          metalness={0.25}
        />
      </mesh>

      <RoofTrim shape={shape} height={height} palette={palette} />
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, height + 0.5, 0]}>
          <shapeGeometry args={[shape]} />
          <meshBasicMaterial color={palette.trim} transparent opacity={0.18} toneMapped={false} />
        </mesh>
      )}
      <FacadeTexture metrics={metrics} height={height} palette={palette} selected={isSelected} />
      <FileNamePanels metrics={metrics} height={height} building={building} palette={palette} selected={isSelected} />
      <PlotLabel metrics={metrics} height={height} building={building} index={index} />
      {isSearchMatch && <BuildingSpotlight metrics={metrics} height={height} palette={palette} />}
    </group>
  );
}

export default function CityScene() {
  const { scene } = useGLTF('/city_infrastructure_base_map.glb');
  const buildings = useCityStore(s => s.buildings);
  const [infrastructureRoot, setInfrastructureRoot] = useState(null);
  const occupiedPlotIndexes = useMemo(
    () => buildings.map((building, index) => (building ? index : null)).filter(index => index !== null),
    [buildings],
  );

  return (
    <group>
      <BaseMap scene={scene} onReady={setInfrastructureRoot} />

      {plotsData.map((plot, index) => (
        <PlotBuilding
          key={index}
          plot={plot}
          index={index}
          building={buildings[index] || null}
        />
      ))}

      <CarDriver infrastructureRoot={infrastructureRoot} occupiedPlotIndexes={occupiedPlotIndexes} />
    </group>
  );
}

useGLTF.preload('/city_infrastructure_base_map.glb');
useGLTF.preload('/micro__car_v1__blue_enerald3d.glb');
