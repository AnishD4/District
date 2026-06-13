import { useCityStore } from '../../store/cityStore';

export function DriveModeOverlay() {
  const cameraMode = useCityStore((s) => s.cameraMode);
  const setCameraMode = useCityStore((s) => s.setCameraMode);

  if (cameraMode === 'drive') {
    return (
      <div className="drive-overlay">
        <button
          type="button"
          className="drive-overlay__exit btn-accent"
          onClick={() => setCameraMode('orbit')}
        >
          Exit drive
        </button>
        <div className="drive-overlay__hud glass-panel">
          <p>W / S — drive & brake</p>
          <p>A / D — steer</p>
          <p>Click — look around · Esc — exit</p>
        </div>
      </div>
    );
  }

  return (
    <div className="drive-overlay drive-overlay--orbit">
      <button
        type="button"
        className="drive-overlay__enter btn-accent"
        onClick={() => setCameraMode('drive')}
      >
        Drive the city
      </button>
    </div>
  );
}
