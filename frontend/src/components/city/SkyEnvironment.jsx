import { useMemo } from 'react';
import { Sky, Clouds, Cloud, Environment } from '@react-three/drei';
import { useCityStore } from '../../store/cityStore';
import { CITY_CENTER } from '../../lib/plotUtils';
import { NightStars } from './NightStars';

const [centerX, , centerZ] = CITY_CENTER;

export const ATMOSPHERE_PRESETS = {
  dawn: {
    background: '#c47a6a',
    fog: ['#e8b8a0', 400, 1800],
    sunPosition: [0.3, 0.08, -0.5],
    turbidity: 6,
    rayleigh: 3,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.7,
    hemisphere: ['#ffd5b0', '#3a2830', 0.45],
    ambient: '#ff9966',
    ambientIntensity: 0.35,
    sunColor: '#ffcc88',
    sunPos: [80, 60, -40],
    sunIntensity: 1.0,
    cloudOpacity: 0.55,
    cloudColor: '#ffc8a8',
    showStars: false,
    showClouds: true,
    environment: 'sunset',
  },
  day: {
    background: '#5a9fd4',
    fog: ['#a8cde8', 500, 2200],
    sunPosition: [0.2, 1, 0.3],
    turbidity: 4,
    rayleigh: 2,
    mieCoefficient: 0.003,
    mieDirectionalG: 0.6,
    hemisphere: ['#c8dff0', '#2a3040', 0.4],
    ambient: '#ffffff',
    ambientIntensity: 0.55,
    sunColor: '#fff8f0',
    sunPos: [120, 220, 80],
    sunIntensity: 1.8,
    cloudOpacity: 0.72,
    cloudColor: '#ffffff',
    showStars: false,
    showClouds: true,
    environment: 'city',
  },
  dusk: {
    background: '#4a2a5a',
    fog: ['#c07870', 350, 1600],
    sunPosition: [-0.3, 0.06, 0.6],
    turbidity: 8,
    rayleigh: 4,
    mieCoefficient: 0.008,
    mieDirectionalG: 0.75,
    hemisphere: ['#ff8866', '#1a1028', 0.35],
    ambient: '#cc5533',
    ambientIntensity: 0.3,
    sunColor: '#ff8844',
    sunPos: [-80, 40, 100],
    sunIntensity: 0.9,
    cloudOpacity: 0.5,
    cloudColor: '#ff9988',
    showStars: false,
    showClouds: true,
    environment: 'sunset',
  },
  night: {
    background: '#060a14',
    fog: ['#0d1528', 300, 1400],
    sunPosition: [0, -1, 0.2],
    turbidity: 1,
    rayleigh: 0.1,
    mieCoefficient: 0.001,
    mieDirectionalG: 0.5,
    hemisphere: ['#1a2848', '#020408', 0.25],
    ambient: '#112244',
    ambientIntensity: 0.12,
    sunColor: '#8899cc',
    sunPos: [60, 180, -80],
    sunIntensity: 0.25,
    cloudOpacity: 0.12,
    cloudColor: '#334466',
    showStars: true,
    showClouds: true,
    environment: 'night',
  },
};

const CLOUD_LAYOUT = [
  { seed: 1, position: [centerX - 180, 140, centerZ - 120], bounds: [40, 8, 20], volume: 18, opacity: 1 },
  { seed: 2, position: [centerX + 220, 160, centerZ + 80], bounds: [50, 10, 25], volume: 22, opacity: 0.9 },
  { seed: 3, position: [centerX + 60, 120, centerZ - 280], bounds: [35, 6, 18], volume: 14, opacity: 0.85 },
  { seed: 4, position: [centerX - 300, 100, centerZ + 200], bounds: [45, 8, 22], volume: 16, opacity: 0.8 },
  { seed: 5, position: [centerX + 350, 130, centerZ - 60], bounds: [30, 5, 15], volume: 12, opacity: 0.75 },
  { seed: 6, position: [centerX - 80, 180, centerZ + 320], bounds: [55, 12, 28], volume: 24, opacity: 0.7 },
  { seed: 7, position: [centerX + 140, 90, centerZ + 260], bounds: [28, 5, 14], volume: 10, opacity: 0.65 },
];

function SceneClouds({ opacity, color }) {
  return (
    <Clouds limit={CLOUD_LAYOUT.length}>
      {CLOUD_LAYOUT.map((cloud) => (
        <Cloud
          key={cloud.seed}
          seed={cloud.seed}
          position={cloud.position}
          bounds={cloud.bounds}
          volume={cloud.volume}
          opacity={cloud.opacity * opacity}
          color={color}
          fade={80}
          speed={0.15}
          growth={4}
          segments={24}
        />
      ))}
    </Clouds>
  );
}

export function SkyEnvironment() {
  const timeOfDay = useCityStore((s) => s.timeOfDay);
  const preset = ATMOSPHERE_PRESETS[timeOfDay] || ATMOSPHERE_PRESETS.night;

  const fogArgs = useMemo(() => preset.fog, [preset.fog]);

  return (
    <>
      <color attach="background" args={[preset.background]} />
      <fog attach="fog" args={fogArgs} />

      <Sky
        distance={450000}
        sunPosition={preset.sunPosition}
        turbidity={preset.turbidity}
        rayleigh={preset.rayleigh}
        mieCoefficient={preset.mieCoefficient}
        mieDirectionalG={preset.mieDirectionalG}
        inclination={0.52}
        azimuth={0.25}
      />

      <ambientLight color={preset.ambient} intensity={preset.ambientIntensity} />
      <directionalLight
        position={preset.sunPos}
        color={preset.sunColor}
        intensity={preset.sunIntensity}
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
      <hemisphereLight args={preset.hemisphere} />

      <Environment preset={preset.environment} />

      {preset.showClouds && (
        <SceneClouds opacity={preset.cloudOpacity} color={preset.cloudColor} />
      )}

      {preset.showStars && <NightStars />}
    </>
  );
}
