import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Sky, ContactShadows, Html } from '@react-three/drei';
import CityScene from './components/CityScene';
import { CITY_CENTER } from './lib/plotUtils';

const [centerX, , centerZ] = CITY_CENTER;
const cameraPosition = [centerX + 320, 260, centerZ + 380];

function SceneLoader() {
  return (
    <Html center>
      <div className="scene-loader">
        <div className="scene-loader__spinner" />
        <p>Loading city map…</p>
      </div>
    </Html>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <Canvas
        camera={{ position: cameraPosition, fov: 42, near: 1, far: 5000 }}
        shadows
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#87a8c4']} />
        <fog attach="fog" args={['#b8cde0', 600, 2200]} />

        <Sky
          distance={450000}
          sunPosition={[80, 120, 40]}
          inclination={0.52}
          azimuth={0.25}
        />

        <ambientLight intensity={0.55} />
        <directionalLight
          position={[120, 220, 80]}
          intensity={1.8}
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
        <hemisphereLight args={['#c8dff0', '#2a3040', 0.35]} />

        <Environment preset="city" />

        <Suspense fallback={<SceneLoader />}>
          <CityScene />
        </Suspense>

        <ContactShadows
          position={[centerX, 0.02, centerZ]}
          opacity={0.35}
          scale={1400}
          blur={2.5}
          far={400}
        />

        <OrbitControls
          makeDefault
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
        <p className="app-overlay__hint">Drag to orbit · Scroll to zoom · Right-drag to pan</p>
      </div>
    </div>
  );
}
