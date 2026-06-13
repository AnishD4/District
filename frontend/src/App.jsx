import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Html } from '@react-three/drei';
import CityScene from './components/CityScene';
import { SkyEnvironment } from './components/city/SkyEnvironment';
import { TerrainBase } from './components/city/TerrainBase';
import { MapCameraControls } from './components/city/MapCameraControls';
import { DriveConnectOverlay } from './components/ui/DriveConnectOverlay';
import { DriveModeOverlay } from './components/ui/DriveModeOverlay';
import { CityAssistantPanel } from './components/ui/CityAssistantPanel';
import { TimeOfDayToggle } from './components/ui/TimeOfDayToggle';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useCityData } from './hooks/useCityData';
import { useCityStore } from './store/cityStore';
import { CITY_CENTER, getCameraDistanceLimits, getTerrainDimensions } from './lib/plotUtils';

const [centerX, , centerZ] = CITY_CENTER;
const cameraPosition = [centerX + 320, 260, centerZ + 380];

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

export default function App() {
  useCityData();
  const timeOfDay = useCityStore((s) => s.timeOfDay);
  const cameraMode = useCityStore((s) => s.cameraMode);
  const { maxDistance } = useMemo(() => getCameraDistanceLimits(), []);
  const shadowScale = useMemo(() => {
    const { width, depth } = getTerrainDimensions(maxDistance);
    return Math.max(width, depth);
  }, [maxDistance]);

  return (
    <ErrorBoundary>
      <div className="app-shell" data-time={timeOfDay}>
        <Canvas
          camera={{ position: cameraPosition, fov: 42, near: 1, far: 5000 }}
          shadows
          gl={{ antialias: true }}
        >
          <SkyEnvironment />
          <TerrainBase />

          <Suspense fallback={<SceneLoader />}>
            <CityScene />
          </Suspense>

          <ContactShadows
            position={[centerX, 0.02, centerZ]}
            opacity={0.35}
            scale={shadowScale}
            blur={2.5}
            far={400}
          />

          {cameraMode === 'orbit' && <MapCameraControls />}
        </Canvas>

        {cameraMode === 'orbit' && (
          <div className="app-overlay glass-panel">
            <p className="app-overlay__eyebrow">District</p>
            <h1>City Viewer</h1>
            <p className="app-overlay__copy">
              29 mapped plots on the infrastructure base map with procedural building fills.
            </p>
            <p className="app-overlay__hint">Drag to orbit - Scroll to zoom - Right-drag to pan</p>
          </div>
        )}

        {cameraMode === 'orbit' && <CityAssistantPanel />}

        <div className="app-time-toggle">
          <TimeOfDayToggle />
        </div>

        <DriveModeOverlay />
        <DriveConnectOverlay />
        <PlotFilesPanel />
      </div>
    </ErrorBoundary>
  );
}
