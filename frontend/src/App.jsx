import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Sky, ContactShadows, Html, Stars } from '@react-three/drei';
import CityScene from './components/CityScene';
import { DriveConnectOverlay } from './components/ui/DriveConnectOverlay';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useCityData } from './hooks/useCityData';
import { CITY_CENTER, PLOT_BOUNDS } from './lib/plotUtils';
import { useCityStore } from './store/cityStore';
import plotsData from './data/plots.json';

const [centerX, , centerZ] = CITY_CENTER;
const cameraPosition = [centerX + 320, 260, centerZ + 380];

const SCENE_THEME = {
  day: {
    background: '#87a8c4',
    fog: '#b8cde0',
    fogNear: 600,
    fogFar: 2200,
    sunPosition: [80, 120, 40],
    ambient: 0.55,
    directional: 1.8,
    hemisphere: ['#c8dff0', '#2a3040', 0.35],
  },
  night: {
    background: '#050711',
    fog: '#08101d',
    fogNear: 420,
    fogFar: 1700,
    sunPosition: [-80, -40, -120],
    ambient: 0.18,
    directional: 0.45,
    hemisphere: ['#20304f', '#02030a', 0.28],
  },
};

function SceneLoader() {
  return (
    <Html center>
      <div className="scene-loader">
        <div className="scene-loader__spinner" />
        <p>Loading city map...</p>
      </div>
    </Html>
  );
}

function pointInPlot(x, z, plot) {
  let inside = false;
  for (let i = 0, j = plot.length - 1; i < plot.length; j = i, i += 1) {
    const xi = plot[i][0];
    const zi = plot[i][2];
    const xj = plot[j][0];
    const zj = plot[j][2];
    const intersects = ((zi > z) !== (zj > z))
      && (x < ((xj - xi) * (z - zi)) / (zj - zi) + xi);

    if (intersects) inside = !inside;
  }
  return inside;
}

function collidesWithPlot(x, z) {
  const radius = 4.5;
  const samples = [
    [0, 0],
    [radius, 0],
    [-radius, 0],
    [0, radius],
    [0, -radius],
  ];

  return samples.some(([dx, dz]) => (
    plotsData.some(plot => pointInPlot(x + dx, z + dz, plot))
  ));
}

function clampToCity(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function DriveController({ enabled }) {
  const { camera, gl } = useThree();
  const keys = useRef({});
  const yaw = useRef(Math.PI);
  const pitch = useRef(-0.05);
  const initialized = useRef(false);

  useEffect(() => {
    if (!enabled) {
      initialized.current = false;
      return undefined;
    }

    const handleKeyDown = (event) => {
      keys.current[event.key.toLowerCase()] = true;
      if (event.key === 'Escape') document.exitPointerLock?.();
    };
    const handleKeyUp = (event) => {
      keys.current[event.key.toLowerCase()] = false;
    };
    const handleMouseMove = (event) => {
      if (document.pointerLockElement !== gl.domElement) return;
      yaw.current -= event.movementX * 0.0022;
      pitch.current = clampToCity(pitch.current - event.movementY * 0.0018, -0.65, 0.38);
    };
    const lockPointer = () => {
      gl.domElement.requestPointerLock?.();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    gl.domElement.addEventListener('click', lockPointer);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      gl.domElement.removeEventListener('click', lockPointer);
    };
  }, [enabled, gl.domElement]);

  useFrame((_, delta) => {
    if (!enabled) return;

    if (!initialized.current) {
      camera.position.set(centerX, 9, PLOT_BOUNDS.minZ - 80);
      yaw.current = Math.PI;
      pitch.current = -0.04;
      initialized.current = true;
    }

    const keyState = keys.current;
    if (keyState.q || keyState.arrowleft) yaw.current += delta * 1.8;
    if (keyState.e || keyState.arrowright) yaw.current -= delta * 1.8;

    const forward = [-Math.sin(yaw.current), -Math.cos(yaw.current)];
    const right = [Math.cos(yaw.current), -Math.sin(yaw.current)];
    let moveX = 0;
    let moveZ = 0;

    if (keyState.w || keyState.arrowup) {
      moveX += forward[0];
      moveZ += forward[1];
    }
    if (keyState.s || keyState.arrowdown) {
      moveX -= forward[0];
      moveZ -= forward[1];
    }
    if (keyState.a) {
      moveX -= right[0];
      moveZ -= right[1];
    }
    if (keyState.d) {
      moveX += right[0];
      moveZ += right[1];
    }

    const magnitude = Math.hypot(moveX, moveZ);
    if (magnitude > 0) {
      const speed = keyState.shift ? 145 : 82;
      const step = speed * delta;
      const nextX = clampToCity(
        camera.position.x + (moveX / magnitude) * step,
        PLOT_BOUNDS.minX - 120,
        PLOT_BOUNDS.maxX + 120,
      );
      const nextZ = clampToCity(
        camera.position.z + (moveZ / magnitude) * step,
        PLOT_BOUNDS.minZ - 120,
        PLOT_BOUNDS.maxZ + 120,
      );

      if (!collidesWithPlot(nextX, nextZ)) {
        camera.position.x = nextX;
        camera.position.z = nextZ;
      } else {
        if (!collidesWithPlot(nextX, camera.position.z)) camera.position.x = nextX;
        if (!collidesWithPlot(camera.position.x, nextZ)) camera.position.z = nextZ;
      }
    }

    camera.position.y = 9;
    camera.rotation.order = 'YXZ';
    camera.rotation.set(pitch.current, yaw.current, 0);
  });

  return null;
}

function getFileRooms(building) {
  if (Array.isArray(building?.file_rooms)) return building.file_rooms;
  if (Array.isArray(building?.file_names)) {
    return building.file_names.map((name, index) => ({
      id: `${name}-${index}`,
      name,
      type: 'file',
      url: null,
    }));
  }
  return [];
}

function getRoomKind(room) {
  if (room?.type?.includes('folder')) return 'Folder';
  if (room?.type?.includes('document')) return 'Doc';
  if (room?.type?.includes('spreadsheet')) return 'Sheet';
  if (room?.type?.includes('presentation')) return 'Slides';
  if (room?.type?.includes('pdf')) return 'PDF';
  return 'File';
}

function PlotFilesPanel() {
  const selectedPlotIndex = useCityStore(s => s.selectedPlotIndex);
  const buildings = useCityStore(s => s.buildings);
  const setSelectedPlotIndex = useCityStore(s => s.setSelectedPlotIndex);
  const setSelectedBuilding = useCityStore(s => s.setSelectedBuilding);

  if (selectedPlotIndex === null) return null;

  const building = buildings[selectedPlotIndex] || null;
  const rooms = getFileRooms(building);

  const closePanel = () => {
    setSelectedPlotIndex(null);
    setSelectedBuilding(null);
  };

  return (
    <aside className="plot-files-panel glass-panel">
      <div className="plot-files-panel__header">
        <div>
          <p className="plot-files-panel__eyebrow">Plot {selectedPlotIndex + 1}</p>
          <h2>{building?.name || 'Empty plot'}</h2>
        </div>
        <button type="button" onClick={closePanel} aria-label="Close files panel">x</button>
      </div>

      {building?.files_loading && (
        <p className="plot-files-panel__status">Reading files for this plot...</p>
      )}

      {!building && (
        <p className="plot-files-panel__empty">
          No Drive folder is mapped to this plot yet. When more Drive folders are loaded, they will fill the remaining plots.
        </p>
      )}

      {building && !building.files_loading && rooms.length === 0 && (
        <p className="plot-files-panel__empty">
          This building has no files or folders to show yet.
        </p>
      )}

      {rooms.length > 0 && (
        <div className="plot-files-panel__rooms">
          {rooms.map((room, index) => (
            <a
              key={room.id || `${room.name}-${index}`}
              className="plot-files-panel__room"
              href={room.url || undefined}
              target={room.url ? '_blank' : undefined}
              rel={room.url ? 'noreferrer' : undefined}
              onClick={event => {
                if (!room.url) event.preventDefault();
              }}
            >
              <span>{getRoomKind(room)}</span>
              <strong>{room.name}</strong>
            </a>
          ))}
        </div>
      )}
    </aside>
  );
}

function SceneControls() {
  const cameraMode = useCityStore(s => s.cameraMode);
  const setCameraMode = useCityStore(s => s.setCameraMode);
  const themeMode = useCityStore(s => s.themeMode);
  const setThemeMode = useCityStore(s => s.setThemeMode);

  const requestCanvasPointerLock = () => {
    try {
      document.querySelector('canvas')?.requestPointerLock?.();
    } catch {
      // Some browsers only allow pointer lock after clicking directly on the canvas.
    }
  };

  const toggleDrive = () => {
    const nextMode = cameraMode === 'drive' ? 'orbit' : 'drive';
    setCameraMode(nextMode);
    if (nextMode === 'drive') {
      requestCanvasPointerLock();
    } else {
      document.exitPointerLock?.();
    }
  };

  return (
    <div className="scene-controls glass-panel">
      <div className="scene-controls__segment" aria-label="Scene lighting mode">
        <button
          type="button"
          className={themeMode === 'day' ? 'is-active' : ''}
          aria-pressed={themeMode === 'day'}
          onClick={() => setThemeMode('day')}
        >
          Day
        </button>
        <button
          type="button"
          className={themeMode === 'night' ? 'is-active' : ''}
          aria-pressed={themeMode === 'night'}
          onClick={() => setThemeMode('night')}
        >
          Night
        </button>
      </div>
      <button
        type="button"
        className={cameraMode === 'drive' ? 'is-active' : ''}
        onClick={toggleDrive}
      >
        {cameraMode === 'drive' ? 'Exit Drive' : 'Drive City'}
      </button>
      {cameraMode === 'drive' && (
        <p>WASD to drive. Mouse to look. Shift to speed up. Q/E turns. Click the city if the mouse is not locked.</p>
      )}
    </div>
  );
}

export default function App() {
  useCityData();
  const themeMode = useCityStore(s => s.themeMode);
  const cameraMode = useCityStore(s => s.cameraMode);
  const sceneTheme = SCENE_THEME[themeMode] || SCENE_THEME.day;

  return (
    <ErrorBoundary>
      <div className={`app-shell app-shell--${themeMode}`}>
        <Canvas
          camera={{ position: cameraPosition, fov: 42, near: 1, far: 5000 }}
          shadows
          gl={{ antialias: true }}
        >
          <color attach="background" args={[sceneTheme.background]} />
          <fog attach="fog" args={[sceneTheme.fog, sceneTheme.fogNear, sceneTheme.fogFar]} />

          {themeMode === 'day' ? (
            <Sky
              distance={450000}
              sunPosition={sceneTheme.sunPosition}
              inclination={0.52}
              azimuth={0.25}
            />
          ) : (
            <Stars radius={900} depth={80} count={2200} factor={4} fade speed={0.35} />
          )}

          <ambientLight intensity={sceneTheme.ambient} />
          <directionalLight
            position={sceneTheme.sunPosition}
            intensity={sceneTheme.directional}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-left={-900}
            shadow-camera-right={900}
            shadow-camera-top={900}
            shadow-camera-bottom={-900}
            shadow-camera-near={0.5}
            shadow-camera-far={1200}
          />
          <hemisphereLight args={sceneTheme.hemisphere} />

          <Environment preset="city" />

          <Suspense fallback={<SceneLoader />}>
            <CityScene />
          </Suspense>
          <DriveController enabled={cameraMode === 'drive'} />

          <ContactShadows
            position={[centerX, 0.02, centerZ]}
            opacity={0.35}
            scale={1400}
            blur={2.5}
            far={400}
          />

          <OrbitControls
            makeDefault
            enabled={cameraMode !== 'drive'}
            target={[centerX, 0, centerZ]}
            enableDamping
            dampingFactor={0.08}
            minDistance={120}
            maxDistance={1200}
            maxPolarAngle={Math.PI / 2.05}
          />
        </Canvas>

        <div className="app-overlay glass-panel">
          <p className="app-overlay__eyebrow">District</p>
          <h1>City Viewer</h1>
          <p className="app-overlay__copy">
            29 mapped plots on the infrastructure base map with procedural building fills.
          </p>
          <p className="app-overlay__hint">Drag to orbit - Scroll to zoom - Right-drag to pan</p>
        </div>

        <SceneControls />
        <DriveConnectOverlay />
        <PlotFilesPanel />
      </div>
    </ErrorBoundary>
  );
}
