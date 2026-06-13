import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { CityScene } from './components/city/CityScene'
import { UIOverlay } from './components/ui/UIOverlay'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useCityData } from './hooks/useCityData'

export default function App() {
  useCityData()

  return (
    <ErrorBoundary>
      <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
        <Canvas
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          camera={{ position: [0, 120, 180], fov: 55 }}
          shadows
          onCreated={({ gl }) => {
            gl.setPixelRatio(Math.min(window.devicePixelRatio, 2))
            gl.shadowMap.enabled = true
            gl.shadowMap.type = THREE.PCFSoftShadowMap
          }}
        >
          <CityScene />
        </Canvas>
        <UIOverlay />
      </div>
    </ErrorBoundary>
  )
}
