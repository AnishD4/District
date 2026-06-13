# District — Comprehensive Hackathon Implementation Plan

> Ordered for maximum efficiency. Critical path first. Show-only features last.
> Assumes a team of 3–4. Parallel tracks are labeled [A], [B], [C].

---

## ⚡ PRE-HACKATHON CHECKLIST (Do Before the Clock Starts)

Every minute saved here is a minute of building. Complete ALL of the following before Day 1.

### Accounts & Credentials

- [ ] **Google Cloud Console** — Create project named `district-hackathon`. Enable billing. Note `PROJECT_ID`.
- [ ] **Google APIs** — Enable these APIs in the GCP console:
  - Vertex AI API
  - Google Drive API v3
  - Cloud Run API
  - Cloud Build API
  - Secret Manager API
  - Artifact Registry API
  - Cloud Storage API
  - Pub/Sub API
  - IAM API
- [ ] **Supabase** — Create project. Note `SUPABASE_URL` and `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_KEY`.
- [ ] **Supabase** — Enable pgvector extension: Dashboard → Database → Extensions → search "vector" → enable.
- [ ] **Cloudflare** — Create account. Note `CLOUDFLARE_ACCOUNT_ID`.
- [ ] **GCP Service Account** — Create a service account `district-backend@district-hackathon.iam.gserviceaccount.com` with roles: `Vertex AI User`, `Storage Admin`, `Pub/Sub Editor`, `Secret Manager Secret Accessor`. Download JSON key.
- [ ] **Google OAuth 2.0** — In GCP Console → APIs & Services → Credentials → Create OAuth Client ID (Web Application). Add `http://localhost:3000` and your Cloudflare Pages URL to authorized origins. Add `/auth/callback` to redirect URIs. Note `CLIENT_ID` and `CLIENT_SECRET`.

### Repository & Tooling

```bash
# Install global tooling once
npm install -g pnpm   # faster than npm for monorepos
npm install -g @cloudflare/wrangler
curl https://sdk.cloud.google.com | bash  # Google Cloud SDK
gcloud auth login
gcloud config set project district-hackathon
```

### Repository Structure (Create Upfront)

```
district/
├── frontend/          # React + Vite + Three.js
│   ├── src/
│   │   ├── components/
│   │   │   ├── city/         # Three.js scene components
│   │   │   ├── panels/       # Slide-in UI panels
│   │   │   └── ui/           # Minimap, search overlay, toolbar
│   │   ├── store/            # Zustand stores
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # API client, Supabase client, helpers
│   │   └── workers/          # Web Workers
│   ├── public/
│   │   └── assets/           # 3D textures, fonts
│   └── package.json
├── backend/           # Node.js + Fastify
│   ├── src/
│   │   ├── routes/           # Fastify route handlers
│   │   ├── services/         # Gemini, Drive, Supabase service modules
│   │   ├── plugins/          # Fastify plugins (auth, CORS)
│   │   └── index.js          # Entry point
│   ├── Dockerfile
│   └── package.json
├── infra/             # Google Cloud infra scripts
│   ├── migrate.sql           # Supabase schema
│   ├── deploy.sh             # Cloud Run deploy script
│   └── secrets.sh            # Push secrets to Secret Manager
└── .env.example
```

### Pre-Scaffold the Monorepo

```bash
mkdir district && cd district
git init
# Frontend
npm create vite@latest frontend -- --template react
cd frontend && pnpm install
pnpm add three @react-three/fiber @react-three/drei zustand react-router-dom \
  framer-motion tailwindcss @tailwindcss/vite gsap @supabase/supabase-js

# Backend
mkdir -p ../backend/src/{routes,services,plugins}
cd ../backend && npm init -y
npm install fastify @fastify/cors @fastify/multipart \
  @google-cloud/vertexai googleapis \
  @supabase/supabase-js dotenv

# Infra
mkdir -p ../infra
```

### Environment Variables (`.env.example`)

```env
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# Google Cloud
GCP_PROJECT_ID=district-hackathon
GCP_REGION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json

# Google OAuth (Drive)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3001/drive/auth/callback

# App
FRONTEND_URL=http://localhost:5173
API_URL=http://localhost:3001
```

---

## PHASE 1 — DATABASE SCHEMA + GCP FOUNDATION
### ⏱ Hour 0:00–0:45 | [B] Backend Dev

This is the FIRST thing to do. Everything else depends on the schema existing.

### 1.1 Run Database Migration

Paste this into Supabase → SQL Editor and execute:

```sql
-- Enable vector extension (if not done via UI)
CREATE EXTENSION IF NOT EXISTS vector;

-- Districts
CREATE TABLE districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text DEFAULT '#6c63ff',
  position_x float DEFAULT 0,
  position_z float DEFAULT 0,
  radius float DEFAULT 50,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Buildings
CREATE TABLE buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id uuid REFERENCES districts(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text CHECK (type IN ('project','subject','personal','work')) DEFAULT 'project',
  position_x float DEFAULT 0,
  position_z float DEFAULT 0,
  height float DEFAULT 10,
  embedding vector(768),
  file_count int DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX buildings_embedding_idx ON buildings 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Rooms
CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid REFERENCES buildings(id) ON DELETE CASCADE,
  name text NOT NULL,
  room_type text CHECK (room_type IN ('files','notes','code','docs','chat')) DEFAULT 'files'
);

-- Files
CREATE TABLE files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  name text NOT NULL,
  content text,
  drive_file_id text,
  url text,
  mime_type text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX files_room_idx ON files(room_id);

-- Connections (Skybridges)
CREATE TABLE connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_a uuid REFERENCES buildings(id) ON DELETE CASCADE,
  building_b uuid REFERENCES buildings(id) ON DELETE CASCADE,
  strength float CHECK (strength >= 0 AND strength <= 1),
  created_at timestamptz DEFAULT now(),
  UNIQUE(building_a, building_b)
);

-- AI Conversations
CREATE TABLE ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid REFERENCES buildings(id) ON DELETE CASCADE,
  messages jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security (simple: user owns their data)
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their districts" ON districts
  USING (user_id = auth.uid());

-- Seed demo data
INSERT INTO districts (id, name, color, position_x, position_z, radius)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Work', '#6c63ff', -80, 0, 60),
  ('22222222-2222-2222-2222-222222222222', 'Research', '#ff6b6b', 80, 0, 60),
  ('33333333-3333-3333-3333-333333333333', 'Personal', '#4ecdc4', 0, 120, 50);

INSERT INTO buildings (id, district_id, name, type, position_x, position_z, height)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'District App', 'project', -80, 0, 25),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Machine Learning', 'subject', 80, 0, 20),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 'Journal', 'personal', 0, 120, 15);
```

### 1.2 Google Cloud: Push Secrets to Secret Manager

```bash
# From /infra/secrets.sh
gcloud secrets create SUPABASE_URL --data-file=<(echo -n "$SUPABASE_URL")
gcloud secrets create SUPABASE_SERVICE_KEY --data-file=<(echo -n "$SUPABASE_SERVICE_KEY")
gcloud secrets create GOOGLE_CLIENT_SECRET --data-file=<(echo -n "$GOOGLE_CLIENT_SECRET")
gcloud secrets create GOOGLE_CLIENT_ID --data-file=<(echo -n "$GOOGLE_CLIENT_ID")

# Grant Cloud Run service account access
gcloud projects add-iam-policy-binding district-hackathon \
  --member="serviceAccount:district-backend@district-hackathon.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 1.3 Create GCS Bucket (for PDF text extraction staging)

```bash
gcloud storage buckets create gs://district-uploads \
  --location=us-central1 \
  --uniform-bucket-level-access

# Set lifecycle: auto-delete uploads after 24h
gcloud storage buckets update gs://district-uploads \
  --lifecycle-file=infra/lifecycle.json
```

`infra/lifecycle.json`:
```json
{ "rule": [{ "action": {"type": "Delete"}, "condition": {"age": 1} }] }
```

### 1.4 Create Pub/Sub Topic (for Drive Webhooks)

```bash
gcloud pubsub topics create drive-notifications
gcloud pubsub subscriptions create drive-notifications-sub \
  --topic=drive-notifications \
  --push-endpoint=https://YOUR_CLOUD_RUN_URL/drive/webhook \
  --push-auth-service-account=district-backend@district-hackathon.iam.gserviceaccount.com
```

---

## PHASE 2 — FASTIFY BACKEND SKELETON
### ⏱ Hour 0:30–1:30 | [B]

Get the API running so the frontend has something to call. No AI yet — just CRUD.

### 2.1 Fastify Entry Point (`backend/src/index.js`)

```js
import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import { createClient } from '@supabase/supabase-js'

const fastify = Fastify({ logger: true })

// Plugins
await fastify.register(cors, { origin: process.env.FRONTEND_URL })
await fastify.register(multipart)

// Supabase client (service role = bypass RLS for backend)
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Routes
await fastify.register(import('./routes/city.js'), { prefix: '/' })
await fastify.register(import('./routes/buildings.js'), { prefix: '/buildings' })
await fastify.register(import('./routes/ai.js'), { prefix: '/ai' })
await fastify.register(import('./routes/drive.js'), { prefix: '/drive' })
await fastify.register(import('./routes/search.js'), { prefix: '/search' })

await fastify.listen({ port: 3001, host: '0.0.0.0' })
```

### 2.2 City Route (`backend/src/routes/city.js`)

```js
// GET /city — returns full city state
export default async function cityRoutes(fastify) {
  fastify.get('/city', async (req, reply) => {
    const [districts, buildings, connections] = await Promise.all([
      supabase.from('districts').select('*'),
      supabase.from('buildings').select('id,name,type,district_id,position_x,position_z,height,file_count,last_updated'),
      supabase.from('connections').select('building_a,building_b,strength'),
    ])
    return { districts: districts.data, buildings: buildings.data, connections: connections.data }
  })
}
```

### 2.3 Buildings Route (`backend/src/routes/buildings.js`)

```js
export default async function buildingRoutes(fastify) {
  // GET /buildings/:id — building + rooms + files
  fastify.get('/:id', async (req) => {
    const { data } = await supabase
      .from('buildings')
      .select(`*, rooms(*, files(*))`)
      .eq('id', req.params.id)
      .single()
    return data
  })

  // POST /buildings — create building
  fastify.post('/', async (req, reply) => {
    const { data, error } = await supabase.from('buildings').insert(req.body).select().single()
    if (error) return reply.code(400).send(error)
    reply.code(201).send(data)
  })

  // PATCH /buildings/:id — update position, name, height
  fastify.patch('/:id', async (req) => {
    const { data } = await supabase.from('buildings')
      .update(req.body).eq('id', req.params.id).select().single()
    return data
  })

  // POST /buildings/:id/files — upload a file
  fastify.post('/:id/files', async (req, reply) => {
    const data = await req.file()
    const buffer = await data.toBuffer()
    const content = buffer.toString('utf-8') // plain text for now; PDF handled in AI phase
    const { data: room } = await supabase.from('rooms')
      .select('id').eq('building_id', req.params.id).eq('room_type', 'files').single()
    const { data: file } = await supabase.from('files').insert({
      room_id: room.id, name: data.filename, content, mime_type: data.mimetype
    }).select().single()
    // Increment file count
    await supabase.rpc('increment_file_count', { building_id: req.params.id })
    return file
  })
}
```

Add this RPC to Supabase:
```sql
CREATE OR REPLACE FUNCTION increment_file_count(building_id uuid)
RETURNS void AS $$
  UPDATE buildings SET file_count = file_count + 1, last_updated = now()
  WHERE id = building_id;
$$ LANGUAGE sql;
```

### 2.4 Backend Dockerfile

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ ./src/
EXPOSE 3001
CMD ["node", "--experimental-vm-modules", "src/index.js"]
```

---

## PHASE 3 — THREE.JS CITY SCENE (STATIC)
### ⏱ Hour 0:30–2:00 | [A] Frontend/3D Dev

[Runs in parallel with Phase 2.] Build the scene from scratch — no API calls yet, use hardcoded data. Wire up real data in Phase 5.

### 3.1 Vite Config

```js
// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': { target: 'http://localhost:3001', rewrite: (p) => p.replace(/^\/api/, '') } } }
})
```

### 3.2 Tailwind Config + CSS Variables

```css
/* src/index.css */
@import "tailwindcss";

:root {
  --bg: #0d0d0f;
  --surface: #16161a;
  --border: rgba(255,255,255,0.08);
  --accent: #6c63ff;
  --text-primary: #f0eff5;
  --text-secondary: #8b8a96;
}

body { background: var(--bg); color: var(--text-primary); font-family: 'Inter', sans-serif; overflow: hidden; }
```

```html
<!-- index.html: add fonts -->
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Inter:wght@400;500&family=JetBrains+Mono&display=swap" rel="stylesheet">
```

### 3.3 Zustand City Store

```js
// src/store/cityStore.js
import { create } from 'zustand'

export const useCityStore = create((set, get) => ({
  // City data
  districts: [],
  buildings: [],
  connections: [],
  
  // Selection state
  hoveredBuilding: null,
  selectedBuilding: null,
  
  // Camera mode
  cameraMode: 'orbit', // 'orbit' | 'drive' | 'interior'
  
  // UI
  activePanels: [],        // ['building', 'drive', 'chat']
  timeOfDay: 'night',      // 'dawn' | 'day' | 'dusk' | 'night' | 'overcast'
  searchQuery: '',
  searchResults: [],
  
  // Actions
  setCityData: (data) => set(data),
  setHoveredBuilding: (id) => set({ hoveredBuilding: id }),
  setSelectedBuilding: (id) => set({ selectedBuilding: id }),
  setCameraMode: (mode) => set({ cameraMode: mode }),
  setTimeOfDay: (preset) => set({ timeOfDay: preset }),
  openPanel: (panel) => set((s) => ({ activePanels: [...new Set([...s.activePanels, panel])] })),
  closePanel: (panel) => set((s) => ({ activePanels: s.activePanels.filter(p => p !== panel) })),
  setSearchResults: (results) => set({ searchResults: results }),
}))
```

### 3.4 Main App + Canvas

```jsx
// src/App.jsx
import { Canvas } from '@react-three/fiber'
import { CityScene } from './components/city/CityScene'
import { UIOverlay } from './components/ui/UIOverlay'
import { useCityData } from './hooks/useCityData'

export default function App() {
  useCityData() // fetch and populate store

  return (
    <div className="w-screen h-screen relative">
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
  )
}
```

### 3.5 CityScene Component

```jsx
// src/components/city/CityScene.jsx
import { Sky } from '@react-three/drei'
import { BuildingMesh } from './BuildingMesh'
import { ConnectionBridge } from './ConnectionBridge'
import { CityGround } from './CityGround'
import { CityLighting } from './CityLighting'
import { CameraController } from './CameraController'
import { useCityStore } from '../../store/cityStore'

export function CityScene() {
  const { buildings, connections, timeOfDay } = useCityStore()

  return (
    <>
      <CityLighting timeOfDay={timeOfDay} />
      <CityGround />
      <Sky sunPosition={timeOfDayToSunPos(timeOfDay)} turbidity={8} rayleigh={2} />

      {/* Buildings — instanced by type for performance */}
      {buildings.map(b => <BuildingMesh key={b.id} building={b} />)}

      {/* Skybridges */}
      {connections.map(c => <ConnectionBridge key={c.id} connection={c} buildings={buildings} />)}

      <CameraController />
    </>
  )
}

function timeOfDayToSunPos(preset) {
  const positions = {
    dawn:     [0.1, 0.05, -1],
    day:      [0, 1, 0],
    dusk:     [-0.1, 0.08, 1],
    night:    [0, -1, 0],
    overcast: [0, 0.5, 0],
  }
  return positions[preset] || positions.day
}
```

### 3.6 Building Mesh (Critical — uses instancing + raycasting)

```jsx
// src/components/city/BuildingMesh.jsx
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { useCityStore } from '../../store/cityStore'
import { gsap } from 'gsap'

export function BuildingMesh({ building }) {
  const meshRef = useRef()
  const { hoveredBuilding, selectedBuilding, setHoveredBuilding, setSelectedBuilding, openPanel } = useCityStore()
  const isHovered = hoveredBuilding === building.id
  const isSelected = selectedBuilding === building.id

  // Animate emissive on hover
  useFrame(() => {
    if (!meshRef.current) return
    const target = isHovered || isSelected ? 0.3 : 0.0
    meshRef.current.material.emissiveIntensity += (target - meshRef.current.material.emissiveIntensity) * 0.1
  })

  const handleClick = () => {
    setSelectedBuilding(building.id)
    openPanel('building')
    // Camera zoom handled in CameraController
  }

  return (
    <group position={[building.position_x, 0, building.position_z]}>
      <mesh
        ref={meshRef}
        position={[0, building.height / 2, 0]}
        castShadow
        receiveShadow
        onPointerOver={() => setHoveredBuilding(building.id)}
        onPointerOut={() => setHoveredBuilding(null)}
        onClick={handleClick}
      >
        <boxGeometry args={[12, building.height, 12]} />
        <meshStandardMaterial
          color={getBuildingColor(building.type)}
          emissive={getBuildingColor(building.type)}
          emissiveIntensity={0}
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>

      {/* Window glow planes — subtle emissive texture */}
      <WindowPanes height={building.height} />

      {/* Name label — always faces camera */}
      <Text
        position={[0, building.height + 4, 0]}
        fontSize={3}
        color={isHovered ? '#ffffff' : '#8b8a96'}
        font="/fonts/SpaceGrotesk-SemiBold.woff"
        anchorX="center"
        anchorY="middle"
      >
        {building.name}
      </Text>
    </group>
  )
}

function getBuildingColor(type) {
  return { project: '#6c63ff', subject: '#4ecdc4', personal: '#ff6b6b', work: '#ffd93d' }[type] || '#6c63ff'
}

function WindowPanes({ height }) {
  // Emissive window planes tiled up the building face
  const rows = Math.floor(height / 4)
  return Array.from({ length: rows }).map((_, i) => (
    <mesh key={i} position={[6.01, i * 4 + 2, 0]}>
      <planeGeometry args={[2, 1.5]} />
      <meshStandardMaterial emissive="#ffcc88" emissiveIntensity={0.8} transparent opacity={0.9} />
    </mesh>
  ))
}
```

### 3.7 Skybridge (Connection) Mesh

```jsx
// src/components/city/ConnectionBridge.jsx
import { useMemo, useRef } from 'react'
import { CatmullRomCurve3, Vector3, TubeGeometry } from 'three'
import { useFrame } from '@react-three/fiber'

export function ConnectionBridge({ connection, buildings }) {
  const buildingA = buildings.find(b => b.id === connection.building_a)
  const buildingB = buildings.find(b => b.id === connection.building_b)
  if (!buildingA || !buildingB) return null

  const meshRef = useRef()
  const growProgress = useRef(0)

  // Animate bridge growing in over 800ms
  useFrame((_, delta) => {
    if (growProgress.current < 1) {
      growProgress.current = Math.min(1, growProgress.current + delta / 0.8)
    }
  })

  const curve = useMemo(() => {
    const aPos = new Vector3(buildingA.position_x, buildingA.height, buildingA.position_z)
    const bPos = new Vector3(buildingB.position_x, buildingB.height, buildingB.position_z)
    const mid = aPos.clone().lerp(bPos, 0.5)
    mid.y += 30 // arc upward
    return new CatmullRomCurve3([aPos, mid, bPos])
  }, [buildingA, buildingB])

  const tubeWidth = connection.strength * 2 + 0.5 // 0.5–2.5 radius

  return (
    <mesh ref={meshRef}>
      <tubeGeometry args={[curve, 32, tubeWidth, 8, false]} />
      <meshStandardMaterial
        color="#6c63ff"
        emissive="#6c63ff"
        emissiveIntensity={0.4}
        transparent
        opacity={0.6 * growProgress.current}
      />
    </mesh>
  )
}
```

### 3.8 Ground Plane + District Zones

```jsx
// src/components/city/CityGround.jsx
import { useCityStore } from '../../store/cityStore'

export function CityGround() {
  const { districts } = useCityStore()
  return (
    <group>
      {/* Main ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color="#0a0a0c" roughness={0.9} />
      </mesh>

      {/* District zones — subtle colored circles */}
      {districts.map(d => (
        <mesh key={d.id} rotation={[-Math.PI / 2, 0, 0]} position={[d.position_x, 0.1, d.position_z]}>
          <circleGeometry args={[d.radius, 64]} />
          <meshStandardMaterial color={d.color} transparent opacity={0.08} />
        </mesh>
      ))}
    </group>
  )
}
```

### 3.9 City Lighting

```jsx
// src/components/city/CityLighting.jsx
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

const TIME_CONFIGS = {
  dawn:     { ambient: '#ff9966', ambientIntensity: 0.3, sunColor: '#ffcc88', sunPos: [50, 20, 0] },
  day:      { ambient: '#ffffff', ambientIntensity: 0.6, sunColor: '#ffffff', sunPos: [50, 150, 50] },
  dusk:     { ambient: '#cc5533', ambientIntensity: 0.3, sunColor: '#ff8844', sunPos: [-50, 15, 0] },
  night:    { ambient: '#112244', ambientIntensity: 0.15, sunColor: '#aabbff', sunPos: [0, -100, 50] },
  overcast: { ambient: '#aaaaaa', ambientIntensity: 0.5, sunColor: '#cccccc', sunPos: [0, 100, 0] },
}

export function CityLighting({ timeOfDay }) {
  const sunRef = useRef()
  const config = TIME_CONFIGS[timeOfDay]

  return (
    <>
      <ambientLight color={config.ambient} intensity={config.ambientIntensity} />
      <directionalLight
        ref={sunRef}
        position={config.sunPos}
        color={config.sunColor}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={500}
        shadow-camera-left={-200}
        shadow-camera-right={200}
        shadow-camera-top={200}
        shadow-camera-bottom={-200}
      />
      {/* City center spotlight that sweeps to hovered building */}
      <SpotlightController />
    </>
  )
}
```

---

## PHASE 4 — CAMERA CONTROLLER + ORBIT/DRIVE MODES
### ⏱ Hour 1:30–3:00 | [A]

### 4.1 Camera Controller

```jsx
// src/components/city/CameraController.jsx
import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, PointerLockControls } from '@react-three/drei'
import { useCityStore } from '../../store/cityStore'
import { gsap } from 'gsap'

export function CameraController() {
  const { camera } = useThree()
  const { cameraMode, selectedBuilding, buildings } = useCityStore()
  const orbitRef = useRef()
  const velocity = useRef({ x: 0, z: 0 })
  const keysPressed = useRef({})

  // Fly to selected building
  useEffect(() => {
    if (!selectedBuilding || cameraMode !== 'orbit') return
    const b = buildings.find(b => b.id === selectedBuilding)
    if (!b) return
    gsap.to(camera.position, {
      x: b.position_x + 30,
      y: b.height + 20,
      z: b.position_z + 40,
      duration: 0.6,
      ease: 'power2.inOut',
      onUpdate: () => orbitRef.current?.target.set(b.position_x, b.height / 2, b.position_z)
    })
  }, [selectedBuilding])

  // Drive mode WASD
  useEffect(() => {
    if (cameraMode !== 'drive') return
    const down = (e) => { keysPressed.current[e.key.toLowerCase()] = true }
    const up = (e) => { keysPressed.current[e.key.toLowerCase()] = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [cameraMode])

  useFrame((_, delta) => {
    if (cameraMode !== 'drive') return
    const speed = 40
    const friction = 0.88
    const forward = new THREE.Vector3(-Math.sin(camera.rotation.y), 0, -Math.cos(camera.rotation.y))
    const right = new THREE.Vector3(Math.cos(camera.rotation.y), 0, -Math.sin(camera.rotation.y))

    if (keysPressed.current['w']) { velocity.current.x += forward.x * speed * delta; velocity.current.z += forward.z * speed * delta }
    if (keysPressed.current['s']) { velocity.current.x -= forward.x * speed * delta; velocity.current.z -= forward.z * speed * delta }
    if (keysPressed.current['a']) { velocity.current.x -= right.x * speed * delta; velocity.current.z -= right.z * speed * delta }
    if (keysPressed.current['d']) { velocity.current.x += right.x * speed * delta; velocity.current.z += right.z * speed * delta }

    velocity.current.x *= friction
    velocity.current.z *= friction
    camera.position.x += velocity.current.x
    camera.position.z += velocity.current.z
    camera.position.y = 3 // Lock to ground height
  })

  if (cameraMode === 'drive') {
    return <PointerLockControls />
  }
  return <OrbitControls ref={orbitRef} maxPolarAngle={Math.PI / 2.2} minDistance={20} maxDistance={400} />
}
```

### 4.2 Spotlight Controller

```jsx
// src/components/city/SpotlightController.jsx
import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCityStore } from '../../store/cityStore'

export function SpotlightController() {
  const { scene } = useThree()
  const { hoveredBuilding, buildings } = useCityStore()
  const spotRef = useRef()
  const targetPos = useRef({ x: 0, z: 0 })

  useFrame(() => {
    if (!spotRef.current) return
    const hovered = buildings.find(b => b.id === hoveredBuilding)
    const tx = hovered ? hovered.position_x : 0
    const tz = hovered ? hovered.position_z : 0
    const ty = hovered ? hovered.height : 0

    // Lerp spotlight target toward hovered building
    spotRef.current.target.position.x += (tx - spotRef.current.target.position.x) * 0.1
    spotRef.current.target.position.y += (ty - spotRef.current.target.position.y) * 0.1
    spotRef.current.target.position.z += (tz - spotRef.current.target.position.z) * 0.1
    spotRef.current.target.updateMatrixWorld()
    spotRef.current.intensity += ((hovered ? 3 : 0) - spotRef.current.intensity) * 0.08
  })

  return (
    <spotLight
      ref={spotRef}
      position={[0, 200, 0]}
      color="#ffffff"
      intensity={0}
      angle={0.15}
      penumbra={0.5}
      castShadow={false}
    />
  )
}
```

---

## PHASE 5 — DATA FETCHING HOOK + API CLIENT
### ⏱ Hour 1:00–2:00 | [C] Full-stack / Integration Dev

### 5.1 API Client

```js
// src/lib/api.js
const BASE = '/api'

export const api = {
  getCity: () => fetch(`${BASE}/city`).then(r => r.json()),
  getBuilding: (id) => fetch(`${BASE}/buildings/${id}`).then(r => r.json()),
  createBuilding: (data) => fetch(`${BASE}/buildings`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) }).then(r => r.json()),
  updateBuilding: (id, data) => fetch(`${BASE}/buildings/${id}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) }).then(r => r.json()),
  chat: (buildingId, messages) => fetch(`${BASE}/ai/chat`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ building_id: buildingId, messages, stream: true })
  }),
  embed: (buildingId) => fetch(`${BASE}/ai/embed`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ building_id: buildingId }) }).then(r => r.json()),
  search: (q) => fetch(`${BASE}/search?q=${encodeURIComponent(q)}`).then(r => r.json()),
  getDriveFiles: (buildingId) => fetch(`${BASE}/drive/files?building_id=${buildingId}`).then(r => r.json()),
  syncDrive: (buildingId, folderId) => fetch(`${BASE}/drive/sync/${buildingId}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ folder_id: folderId }) }).then(r => r.json()),
}
```

### 5.2 City Data Hook

```js
// src/hooks/useCityData.js
import { useEffect } from 'react'
import { useCityStore } from '../store/cityStore'
import { api } from '../lib/api'

export function useCityData() {
  const setCityData = useCityStore(s => s.setCityData)

  useEffect(() => {
    api.getCity().then(data => {
      setCityData({
        districts: data.districts,
        buildings: data.buildings,
        connections: data.connections,
      })
    })
  }, [])
}
```

---

## PHASE 6 — UI PANELS + MINIMAP
### ⏱ Hour 2:00–3:30 | [C]

### 6.1 UI Overlay Shell

```jsx
// src/components/ui/UIOverlay.jsx
import { Minimap } from './Minimap'
import { SearchOverlay } from './SearchOverlay'
import { Toolbar } from './Toolbar'
import { BuildingPanel } from '../panels/BuildingPanel'
import { useCityStore } from '../../store/cityStore'

export function UIOverlay() {
  const { activePanels } = useCityStore()
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top toolbar */}
      <div className="pointer-events-auto absolute top-4 left-1/2 -translate-x-1/2">
        <Toolbar />
      </div>

      {/* Minimap — always visible */}
      <div className="pointer-events-auto absolute bottom-4 right-4">
        <Minimap />
      </div>

      {/* Right-side panels */}
      {activePanels.includes('building') && (
        <div className="pointer-events-auto absolute top-0 right-0 h-full">
          <BuildingPanel />
        </div>
      )}

      {/* Search overlay (fullscreen) */}
      <SearchOverlay />
    </div>
  )
}
```

### 6.2 Toolbar

```jsx
// src/components/ui/Toolbar.jsx
import { useCityStore } from '../../store/cityStore'

const TIME_PRESETS = ['dawn', 'day', 'dusk', 'night']

export function Toolbar() {
  const { timeOfDay, setTimeOfDay, cameraMode, setCameraMode } = useCityStore()

  const toggleDriveMode = () => {
    setCameraMode(cameraMode === 'drive' ? 'orbit' : 'drive')
  }

  return (
    <div className="flex items-center gap-3 bg-[#16161a] border border-white/10 rounded-2xl px-4 py-2">
      {/* Time of day */}
      <div className="flex gap-1">
        {TIME_PRESETS.map(preset => (
          <button
            key={preset}
            onClick={() => setTimeOfDay(preset)}
            className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
              timeOfDay === preset ? 'bg-[#6c63ff] text-white' : 'text-[#8b8a96] hover:text-white'
            }`}
          >
            {preset}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-white/10" />

      {/* Drive mode */}
      <button
        onClick={toggleDriveMode}
        className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${
          cameraMode === 'drive' ? 'bg-[#6c63ff] text-white' : 'border border-white/10 text-[#8b8a96] hover:text-white hover:border-white/20'
        }`}
      >
        {cameraMode === 'drive' ? '← Exit Drive Mode' : '🚗 Take a Break'}
      </button>
    </div>
  )
}
```

### 6.3 Minimap (Canvas-based 2D)

```jsx
// src/components/ui/Minimap.jsx
import { useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { useCityStore } from '../../store/cityStore'

export function Minimap() {
  const canvasRef = useRef()
  const { buildings, districts, connections, selectedBuilding } = useCityStore()

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d')
    const W = 160, H = 160
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#0d0d0f'
    ctx.fillRect(0, 0, W, H)

    const scale = 0.35, cx = W / 2, cy = H / 2

    // Draw district zones
    districts.forEach(d => {
      ctx.beginPath()
      ctx.arc(cx + d.position_x * scale, cy + d.position_z * scale, d.radius * scale, 0, Math.PI * 2)
      ctx.fillStyle = d.color + '22'
      ctx.fill()
    })

    // Draw connections
    connections.forEach(c => {
      const a = buildings.find(b => b.id === c.building_a)
      const b = buildings.find(b => b.id === c.building_b)
      if (!a || !b) return
      ctx.beginPath()
      ctx.moveTo(cx + a.position_x * scale, cy + a.position_z * scale)
      ctx.lineTo(cx + b.position_x * scale, cy + b.position_z * scale)
      ctx.strokeStyle = `rgba(108,99,255,${c.strength * 0.8})`
      ctx.lineWidth = c.strength * 2
      ctx.stroke()
    })

    // Draw buildings
    buildings.forEach(b => {
      const isSelected = b.id === selectedBuilding
      ctx.beginPath()
      ctx.rect(cx + b.position_x * scale - 3, cy + b.position_z * scale - 3, 6, 6)
      ctx.fillStyle = isSelected ? '#ffffff' : '#6c63ff'
      ctx.fill()
    })
  }, [buildings, districts, connections, selectedBuilding])

  return (
    <div className="rounded-xl overflow-hidden border border-white/10" style={{ width: 160, height: 160 }}>
      <canvas ref={canvasRef} width={160} height={160} style={{ display: 'block' }} />
    </div>
  )
}
```

### 6.4 Building Panel

```jsx
// src/components/panels/BuildingPanel.jsx
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useCityStore } from '../../store/cityStore'
import { api } from '../../lib/api'
import { ChatPanel } from './ChatPanel'
import { DrivePanel } from './DrivePanel'

export function BuildingPanel() {
  const { selectedBuilding, closePanel } = useCityStore()
  const [building, setBuilding] = useState(null)
  const [activeTab, setActiveTab] = useState('files') // 'files' | 'chat'

  useEffect(() => {
    if (!selectedBuilding) return
    api.getBuilding(selectedBuilding).then(setBuilding)
  }, [selectedBuilding])

  return (
    <motion.div
      initial={{ x: 400 }}
      animate={{ x: 0 }}
      exit={{ x: 400 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="h-full w-96 bg-[#16161a] border-l border-white/8 flex flex-col"
    >
      {/* Header */}
      <div className="p-5 border-b border-white/8">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white font-['Space_Grotesk']">{building?.name}</h2>
            <p className="text-sm text-[#8b8a96] mt-0.5">{building?.file_count} files · {building?.type}</p>
          </div>
          <button onClick={() => closePanel('building')} className="text-[#8b8a96] hover:text-white text-xl">×</button>
        </div>

        <div className="flex gap-2 mt-4">
          {['files', 'chat'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 text-sm rounded-lg capitalize transition-all ${
                activeTab === tab ? 'bg-[#6c63ff] text-white' : 'text-[#8b8a96] hover:text-white'
              }`}
            >
              {tab === 'chat' ? '✦ AI Resident' : '📁 Files'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'files' && building && <DrivePanel building={building} />}
        {activeTab === 'chat' && building && <ChatPanel building={building} />}
      </div>
    </motion.div>
  )
}
```

---

## PHASE 7 — VERTEX AI + GEMINI CHAT
### ⏱ Hour 3:00–5:00 | [B]

This is where Google Cloud shines. Route ALL AI calls through Vertex AI in Cloud Run.

### 7.1 Vertex AI Service (`backend/src/services/vertexai.js`)

```js
import { VertexAI } from '@google-cloud/vertexai'

const vertexAI = new VertexAI({
  project: process.env.GCP_PROJECT_ID,
  location: process.env.GCP_REGION || 'us-central1',
})

// Chat model — long context
export const geminiPro = vertexAI.getGenerativeModel({
  model: 'gemini-1.5-pro',
  generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
})

// Fast model — quick lookups
export const geminiFlash = vertexAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  generationConfig: { maxOutputTokens: 512, temperature: 0.3 },
})

// Embedding model
export const getEmbedding = async (text) => {
  const embeddingModel = vertexAI.getGenerativeModel({ model: 'text-embedding-004' })
  const result = await embeddingModel.embedContent(text)
  return result.embedding.values  // 768-dim vector
}
```

### 7.2 Build Gemini System Prompt from Building Context

```js
// backend/src/services/contextBuilder.js
import { supabase } from '../index.js'

export async function buildBuildingContext(buildingId) {
  const { data: building } = await supabase
    .from('buildings')
    .select(`*, rooms(*, files(name, content))`)
    .eq('id', buildingId)
    .single()

  // Aggregate all file content (Gemini 1.5 Pro handles 500k tokens)
  const fileContent = building.rooms
    .flatMap(r => r.files)
    .filter(f => f.content)
    .map(f => `--- FILE: ${f.name} ---\n${f.content}`)
    .join('\n\n')

  // Get all building names for cross-reference
  const { data: allBuildings } = await supabase.from('buildings').select('id, name')
  const buildingList = allBuildings.map(b => b.name).join(', ')

  return `You are the AI assistant for "${building.name}" in District.
Building type: ${building.type}
District: This building's project category

Other buildings in the city: ${buildingList}

You have access to the following files and notes:
${fileContent || '[No files yet — help the user add content to this building]'}

Guidelines:
- Answer questions about this project specifically
- When you see connections to other buildings by name, mention them explicitly
- Be concise, direct, and technically precise
- If you mention another building, preface it with "→ [Building Name]" so the UI can detect it`
}
```

### 7.3 Chat Route with Streaming

```js
// backend/src/routes/ai.js
import { supabase } from '../index.js'
import { geminiPro, getEmbedding } from '../services/vertexai.js'
import { buildBuildingContext } from '../services/contextBuilder.js'

export default async function aiRoutes(fastify) {

  // POST /ai/chat — streaming response
  fastify.post('/chat', async (req, reply) => {
    const { building_id, messages } = req.body

    const systemPrompt = await buildBuildingContext(building_id)

    // Build Gemini message history
    const geminiMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))

    const chat = geminiPro.startChat({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      history: geminiMessages.slice(0, -1) // all but last
    })

    const lastMessage = messages[messages.length - 1].content

    // Set up SSE streaming
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')

    const stream = await chat.sendMessageStream(lastMessage)
    let fullResponse = ''

    for await (const chunk of stream.stream) {
      const text = chunk.candidates[0]?.content?.parts[0]?.text || ''
      fullResponse += text
      reply.raw.write(`data: ${JSON.stringify({ text })}\n\n`)
    }

    reply.raw.write('data: [DONE]\n\n')
    reply.raw.end()

    // After response: save conversation + trigger background embed
    await supabase.from('ai_conversations').upsert({
      building_id,
      messages: [...messages, { role: 'assistant', content: fullResponse }]
    })

    // Trigger embedding update (non-blocking)
    triggerEmbeddingUpdate(building_id, fullResponse).catch(console.error)
  })

  // POST /ai/embed — re-embed a building, find connections
  fastify.post('/embed', async (req) => {
    const { building_id } = req.body
    return updateBuildingEmbedding(building_id)
  })
}

async function triggerEmbeddingUpdate(buildingId, newContent) {
  // Wait 2s for conversation to settle, then re-embed
  await new Promise(r => setTimeout(r, 2000))
  await updateBuildingEmbedding(buildingId)
}

async function updateBuildingEmbedding(buildingId) {
  // Fetch all content in building
  const { data: building } = await supabase
    .from('buildings')
    .select(`name, rooms(files(content))`)
    .eq('id', buildingId)
    .single()

  const allText = [
    building.name,
    ...building.rooms.flatMap(r => r.files.map(f => f.content || ''))
  ].join(' ')

  if (!allText.trim()) return { connections: [] }

  const embedding = await getEmbedding(allText.slice(0, 8000)) // limit for embedding model

  // Update building embedding
  await supabase.from('buildings')
    .update({ embedding: JSON.stringify(embedding) })
    .eq('id', buildingId)

  // Find similar buildings using pgvector
  const { data: similar } = await supabase.rpc('find_similar_buildings', {
    query_embedding: JSON.stringify(embedding),
    exclude_id: buildingId,
    threshold: 0.82,
    limit_count: 5
  })

  // Upsert connections
  for (const s of similar) {
    await supabase.from('connections').upsert({
      building_a: buildingId < s.id ? buildingId : s.id,
      building_b: buildingId < s.id ? s.id : buildingId,
      strength: s.similarity
    }, { onConflict: 'building_a,building_b' })
  }

  return { connections: similar }
}
```

Add this RPC to Supabase:
```sql
CREATE OR REPLACE FUNCTION find_similar_buildings(
  query_embedding vector(768),
  exclude_id uuid,
  threshold float,
  limit_count int
)
RETURNS TABLE(id uuid, name text, similarity float) AS $$
  SELECT id, name, 1 - (embedding <=> query_embedding) as similarity
  FROM buildings
  WHERE id != exclude_id
    AND embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > threshold
  ORDER BY similarity DESC
  LIMIT limit_count;
$$ LANGUAGE sql;
```

### 7.4 Chat Panel (Frontend Streaming)

```jsx
// src/components/panels/ChatPanel.jsx
import { useState, useRef, useEffect } from 'react'
import { api } from '../../lib/api'

export function ChatPanel({ building }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Hi! I'm the AI for **${building.name}**. Ask me anything about this project.` }
  ])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef()

  const sendMessage = async () => {
    if (!input.trim() || streaming) return
    const userMsg = { role: 'user', content: input }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setStreaming(true)

    // Append empty assistant message to stream into
    setMessages(m => [...m, { role: 'assistant', content: '' }])

    const response = await api.chat(building.id, newMessages)
    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
      for (const line of lines) {
        const data = line.slice(6)
        if (data === '[DONE]') { setStreaming(false); break }
        try {
          const { text } = JSON.parse(data)
          setMessages(m => {
            const updated = [...m]
            updated[updated.length - 1] = { role: 'assistant', content: updated[updated.length - 1].content + text }
            return updated
          })
        } catch {}
      }
    }
    setStreaming(false)
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              m.role === 'user' ? 'bg-[#6c63ff] text-white' : 'bg-[#0d0d0f] text-[#f0eff5]'
            }`}>
              {m.content}
              {streaming && m.role === 'assistant' && i === messages.length - 1 && (
                <span className="inline-block w-1 h-4 bg-[#6c63ff] ml-0.5 animate-pulse" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-white/8">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Ask about this project..."
            className="flex-1 bg-[#0d0d0f] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#8b8a96] focus:outline-none focus:border-[#6c63ff]"
          />
          <button
            onClick={sendMessage}
            disabled={streaming}
            className="px-4 py-2.5 bg-[#6c63ff] hover:bg-[#7c73ff] text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
          >
            ✦
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## PHASE 8 — GOOGLE DRIVE INTEGRATION
### ⏱ Hour 5:00–7:00 | [B] + [C]

### 8.1 OAuth Route

```js
// backend/src/routes/drive.js
import { google } from 'googleapis'
import { supabase } from '../index.js'

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

export default async function driveRoutes(fastify) {

  // GET /drive/auth — redirect to Google OAuth
  fastify.get('/auth', async (req, reply) => {
    const oauth2Client = getOAuth2Client()
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.file',
      ],
      state: req.query.building_id, // pass building_id through state
    })
    reply.redirect(url)
  })

  // GET /drive/auth/callback
  fastify.get('/auth/callback', async (req, reply) => {
    const { code, state: buildingId } = req.query
    const oauth2Client = getOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)

    // Store tokens in Supabase (associate with building or user)
    await supabase.from('buildings').update({
      // Store as JSONB in a new column (add to schema)
      drive_tokens: tokens
    }).eq('id', buildingId)

    reply.redirect(`${process.env.FRONTEND_URL}?building=${buildingId}&drive=connected`)
  })

  // GET /drive/files — list Drive files for a building
  fastify.get('/files', async (req) => {
    const { building_id } = req.query
    const { data: building } = await supabase.from('buildings')
      .select('drive_tokens, drive_folder_id').eq('id', building_id).single()
    if (!building?.drive_tokens) return { files: [], connected: false }

    const oauth2Client = getOAuth2Client()
    oauth2Client.setCredentials(building.drive_tokens)
    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    const { data } = await drive.files.list({
      q: building.drive_folder_id ? `'${building.drive_folder_id}' in parents` : undefined,
      fields: 'files(id,name,mimeType,modifiedTime,webViewLink)',
      pageSize: 50,
    })
    return { files: data.files, connected: true }
  })

  // POST /drive/sync/:building_id — sync a Drive folder to a building
  fastify.post('/sync/:building_id', async (req) => {
    const { building_id } = req.params
    const { folder_id } = req.body

    const { data: building } = await supabase.from('buildings')
      .select('drive_tokens').eq('id', building_id).single()

    const oauth2Client = getOAuth2Client()
    oauth2Client.setCredentials(building.drive_tokens)
    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    // List files in folder
    const { data: { files } } = await drive.files.list({
      q: `'${folder_id}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,modifiedTime)',
      pageSize: 100,
    })

    // Get or create default room
    const { data: room } = await supabase.from('rooms')
      .upsert({ building_id, name: 'Drive Files', room_type: 'files' }, { onConflict: 'building_id,room_type' })
      .select().single()

    // Sync each file
    const syncResults = await Promise.allSettled(files.map(async (file) => {
      let content = ''

      // Extract text content
      if (file.mimeType === 'application/vnd.google-apps.document') {
        const { data: text } = await drive.files.export({ fileId: file.id, mimeType: 'text/plain' })
        content = text
      } else if (file.mimeType.startsWith('text/')) {
        const { data: text } = await drive.files.get({ fileId: file.id, alt: 'media' })
        content = text
      }
      // PDFs: download binary → upload to GCS → extract text (Phase 10)

      await supabase.from('files').upsert({
        room_id: room.id,
        name: file.name,
        content: content.slice(0, 50000), // limit per file
        drive_file_id: file.id,
        mime_type: file.mimeType,
      }, { onConflict: 'drive_file_id' })
    }))

    // Update building folder ID and file count
    await supabase.from('buildings').update({
      drive_folder_id: folder_id,
      file_count: files.length,
      last_updated: new Date().toISOString()
    }).eq('id', building_id)

    return { synced: files.length, folder_id }
  })

  // POST /drive/webhook — receives Google Drive push notifications via Pub/Sub
  fastify.post('/webhook', async (req) => {
    // Pub/Sub wraps message in base64
    const message = Buffer.from(req.body.message.data, 'base64').toString()
    const notification = JSON.parse(message)
    // Re-sync the affected building
    const { data: building } = await supabase.from('buildings')
      .select('id').eq('drive_folder_id', notification.resourceId).single()
    if (building) {
      // Queue a re-sync (simplified: direct call for hackathon)
      await fastify.inject({ method: 'POST', url: `/drive/sync/${building.id}`, body: { folder_id: notification.resourceId } })
    }
    return { ok: true }
  })
}
```

Add to buildings table migration:
```sql
ALTER TABLE buildings ADD COLUMN drive_tokens jsonb;
ALTER TABLE buildings ADD COLUMN drive_folder_id text;
CREATE UNIQUE INDEX files_drive_file_idx ON files(drive_file_id) WHERE drive_file_id IS NOT NULL;
```

### 8.2 Drive Panel (Frontend)

```jsx
// src/components/panels/DrivePanel.jsx
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'

export function DrivePanel({ building }) {
  const [files, setFiles] = useState([])
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    api.getDriveFiles(building.id).then(({ files, connected }) => {
      setFiles(files || [])
      setConnected(connected)
      setLoading(false)
    })
  }, [building.id])

  const connectDrive = () => {
    window.location.href = `/api/drive/auth?building_id=${building.id}`
  }

  const syncFolder = async () => {
    const folderId = prompt('Paste a Google Drive folder ID (from the URL):')
    if (!folderId) return
    setSyncing(true)
    await api.syncDrive(building.id, folderId)
    const { files: f } = await api.getDriveFiles(building.id)
    setFiles(f || [])
    setSyncing(false)
    // Trigger embedding update in background
    api.embed(building.id)
  }

  if (loading) return <div className="p-4 text-[#8b8a96] text-sm">Loading files...</div>

  if (!connected) {
    return (
      <div className="p-6 flex flex-col items-center gap-3">
        <div className="text-4xl">📁</div>
        <p className="text-sm text-[#8b8a96] text-center">Connect Google Drive to populate this building with your files.</p>
        <button onClick={connectDrive} className="px-4 py-2 bg-[#6c63ff] text-white rounded-xl text-sm font-medium">
          Connect Drive
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-white/8 flex justify-between items-center">
        <span className="text-xs text-[#8b8a96]">{files.length} files</span>
        <button onClick={syncFolder} disabled={syncing} className="text-xs text-[#6c63ff] hover:text-[#8b83ff] disabled:opacity-50">
          {syncing ? 'Syncing...' : '⟳ Sync Folder'}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {files.map(file => (
          <div key={file.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/3 cursor-pointer group">
            <span className="text-base">{getMimeIcon(file.mimeType)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{file.name}</p>
              <p className="text-xs text-[#8b8a96]">{new Date(file.modifiedTime).toLocaleDateString()}</p>
            </div>
            <a href={file.webViewLink} target="_blank" rel="noreferrer"
               className="opacity-0 group-hover:opacity-100 text-xs text-[#6c63ff]">
              Open ↗
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}

function getMimeIcon(mimeType) {
  if (mimeType?.includes('document')) return '📄'
  if (mimeType?.includes('spreadsheet')) return '📊'
  if (mimeType?.includes('presentation')) return '📑'
  if (mimeType?.includes('pdf')) return '📕'
  if (mimeType?.includes('image')) return '🖼️'
  return '📎'
}
```

---

## PHASE 9 — SEMANTIC SEARCH + PGVECTOR
### ⏱ Hour 7:00–9:00 | [B] + [C]

### 9.1 Search Route

```js
// backend/src/routes/search.js
import { getEmbedding } from '../services/vertexai.js'
import { supabase } from '../index.js'

export default async function searchRoutes(fastify) {
  fastify.get('/', async (req) => {
    const { q } = req.query
    if (!q?.trim()) return { results: [] }

    // Embed the search query using Vertex AI
    const queryEmbedding = await getEmbedding(q)

    // pgvector similarity search
    const { data } = await supabase.rpc('semantic_search', {
      query_embedding: JSON.stringify(queryEmbedding),
      threshold: 0.70, // lower threshold for search vs connection
      limit_count: 10
    })

    return { results: data || [] }
  })
}
```

Add to Supabase:
```sql
CREATE OR REPLACE FUNCTION semantic_search(
  query_embedding vector(768),
  threshold float,
  limit_count int
)
RETURNS TABLE(id uuid, name text, type text, district_id uuid, similarity float) AS $$
  SELECT id, name, type, district_id, 1 - (embedding <=> query_embedding) as similarity
  FROM buildings
  WHERE embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > threshold
  ORDER BY similarity DESC
  LIMIT limit_count;
$$ LANGUAGE sql;
```

### 9.2 Search Overlay (Frontend)

```jsx
// src/components/ui/SearchOverlay.jsx
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCityStore } from '../../store/cityStore'
import { api } from '../../lib/api'

export function SearchOverlay() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const { setSelectedBuilding, openPanel, setSearchResults, buildings } = useCityStore()
  const inputRef = useRef()

  // Press / to open
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && !open) { e.preventDefault(); setOpen(true) }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const search = async (q) => {
    setQuery(q)
    if (!q.trim()) { setResults([]); setSearchResults([]); return }
    setSearching(true)
    const { results } = await api.search(q)
    setResults(results)
    setSearchResults(results.map(r => r.id)) // highlight in city
    setSearching(false)
  }

  const selectResult = (result) => {
    setSelectedBuilding(result.id)
    openPanel('building')
    setOpen(false)
    setSearchResults([])
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-24 px-4 z-50"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.95, y: -10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: -10 }}
            className="w-full max-w-xl bg-[#16161a] border border-white/10 rounded-2xl overflow-hidden"
          >
            <div className="flex items-center px-4 border-b border-white/8">
              <span className="text-[#6c63ff] text-lg">✦</span>
              <input
                ref={inputRef}
                value={query}
                onChange={e => search(e.target.value)}
                placeholder="Search your city semantically..."
                className="flex-1 bg-transparent px-3 py-4 text-white placeholder-[#8b8a96] focus:outline-none"
              />
              {searching && <div className="w-4 h-4 border-2 border-[#6c63ff] border-t-transparent rounded-full animate-spin" />}
            </div>

            {results.length > 0 && (
              <div className="max-h-80 overflow-y-auto">
                {results.map(r => (
                  <button
                    key={r.id}
                    onClick={() => selectResult(r)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#6c63ff]/20 flex items-center justify-center text-[#6c63ff] text-xs font-bold">
                      {Math.round(r.similarity * 100)}
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">{r.name}</p>
                      <p className="text-xs text-[#8b8a96] capitalize">{r.type}</p>
                    </div>
                    <div className="ml-auto w-16 h-1 rounded-full bg-[#6c63ff]/30">
                      <div className="h-full bg-[#6c63ff] rounded-full" style={{ width: `${r.similarity * 100}%` }} />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {query && results.length === 0 && !searching && (
              <div className="px-4 py-6 text-center text-[#8b8a96] text-sm">No matching buildings found</div>
            )}

            <div className="px-4 py-2 text-xs text-[#8b8a96] border-t border-white/8">
              Press <kbd className="bg-white/10 px-1.5 py-0.5 rounded">Esc</kbd> to close
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

### 9.3 Highlight Buildings During Search

In `BuildingMesh.jsx`, consume `searchResults` from the store:
```jsx
const searchResults = useCityStore(s => s.searchResults)
const isSearchMatch = searchResults.length > 0 && searchResults.includes(building.id)
const isDimmed = searchResults.length > 0 && !searchResults.includes(building.id)

// In useFrame:
const targetEmissive = isSearchMatch ? 0.6 : isHovered ? 0.3 : 0
meshRef.current.material.emissiveIntensity += (targetEmissive - meshRef.current.material.emissiveIntensity) * 0.1
meshRef.current.material.opacity += ((isDimmed ? 0.2 : 1) - meshRef.current.material.opacity) * 0.1
```

---

## PHASE 10 — GOOGLE CLOUD RUN DEPLOYMENT
### ⏱ Hour 8:00–9:00 | [B] (while [A]+[C] polish frontend)

Deploy the backend to Cloud Run. This makes the API production-ready and lets you test the full stack.

### 10.1 Build & Push Docker Image

```bash
# From backend/
gcloud builds submit --tag gcr.io/district-hackathon/district-api

# Or use Artifact Registry (preferred)
gcloud artifacts repositories create district \
  --repository-format=docker \
  --location=us-central1

docker build -t us-central1-docker.pkg.dev/district-hackathon/district/api:latest .
docker push us-central1-docker.pkg.dev/district-hackathon/district/api:latest
```

### 10.2 Deploy to Cloud Run

```bash
gcloud run deploy district-api \
  --image=us-central1-docker.pkg.dev/district-hackathon/district/api:latest \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --min-instances=1 \
  --max-instances=5 \
  --memory=1Gi \
  --cpu=1 \
  --service-account=district-backend@district-hackathon.iam.gserviceaccount.com \
  --set-secrets="SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_KEY=SUPABASE_SERVICE_KEY:latest,GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest" \
  --set-env-vars="GCP_PROJECT_ID=district-hackathon,GCP_REGION=us-central1,FRONTEND_URL=https://district.pages.dev"
```

### 10.3 Cloud Run uses Application Default Credentials for Vertex AI

Because the Cloud Run service runs as the service account `district-backend`, it automatically has `Vertex AI User` role — no API key needed for Gemini. This is more secure than embedding an API key. On local dev, run:
```bash
gcloud auth application-default login
```

### 10.4 Update CORS After Deployment

Update `FRONTEND_URL` env var on Cloud Run once Cloudflare Pages URL is known:
```bash
gcloud run services update district-api \
  --region=us-central1 \
  --set-env-vars="FRONTEND_URL=https://YOUR_ACTUAL_URL.pages.dev"
```

### 10.5 Deploy Frontend to Cloudflare Pages

```bash
cd frontend
pnpm run build

# One-time setup
wrangler pages project create district

# Deploy
wrangler pages deploy dist --project-name=district

# Set environment variables in Cloudflare dashboard:
# VITE_API_URL = https://district-api-HASH-uc.a.run.app
```

Update `vite.config.js` to use env var for API URL:
```js
server: {
  proxy: {
    '/api': { target: process.env.VITE_API_URL || 'http://localhost:3001', rewrite: p => p.replace(/^\/api/, '') }
  }
}
```

---

## PHASE 11 — SERVICE WORKER + CACHING
### ⏱ Hour 9:00–10:00 | [C]

This is what makes the city feel instant on repeat visits.

### 11.1 Service Worker (`frontend/public/sw.js`)

```js
const CITY_CACHE = 'district-v1'
const ASSET_CACHE = 'district-assets-v1'

// Cache static assets on install
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(ASSET_CACHE).then(cache => cache.addAll([
      '/', '/index.html', '/assets/', // Vite output assets
    ]))
  )
})

// Serve from cache, update in background
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  // City state: stale-while-revalidate
  if (url.pathname === '/api/city') {
    e.respondWith(
      caches.open(CITY_CACHE).then(async cache => {
        const cached = await cache.match(e.request)
        const networkFetch = fetch(e.request).then(res => {
          cache.put(e.request, res.clone())
          return res
        })
        return cached || networkFetch
      })
    )
    return
  }

  // Static assets: cache first
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    )
  }
})
```

Register in `main.jsx`:
```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
}
```

### 11.2 IndexedDB for Drive Files (Offline)

```js
// src/lib/offlineStorage.js
const DB_NAME = 'district-drive', DB_VERSION = 1

export async function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => req.result.createObjectStore('files', { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function cacheFiles(files) {
  const db = await openDB()
  const tx = db.transaction('files', 'readwrite')
  files.forEach(f => tx.objectStore('files').put(f))
  return new Promise(r => { tx.oncomplete = r })
}

export async function getCachedFiles() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction('files', 'readonly').objectStore('files').getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
```

---

## PHASE 12 — DRIVE MODE (TAKE A BREAK)
### ⏱ Hour 10:00–11:00 | [A]

This is already partially implemented in the CameraController (Phase 4). This phase wires up the full experience.

### 12.1 Drive Mode Enhancement

In `CameraController.jsx`, when entering drive mode:
```jsx
useEffect(() => {
  if (cameraMode === 'drive') {
    // Lock camera to street level
    gsap.to(camera.position, { y: 3, duration: 0.6, ease: 'power2.inOut' })
    document.title = 'District — Take a Break 🚗'
  } else {
    // Return to orbit position
    gsap.to(camera.position, {
      x: 0, y: 120, z: 180,
      duration: 0.8, ease: 'power2.inOut'
    })
    document.title = 'District'
  }
}, [cameraMode])
```

### 12.2 Drive Mode Overlay

Show a minimal HUD when in drive mode, with no panels, no notifications:
```jsx
// In UIOverlay.jsx, conditionally render:
{cameraMode === 'drive' ? (
  <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
    <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl px-5 py-3 text-center">
      <p className="text-[#8b8a96] text-xs">WASD to drive · Mouse to look · B or Esc to exit</p>
    </div>
  </div>
) : (
  <> {/* Normal UI */ } </>
)}
```

### 12.3 Ambient Audio (Web Audio API — no library needed)

```js
// src/lib/ambientAudio.js
let audioCtx = null

export function startAmbientAudio() {
  if (audioCtx) return
  audioCtx = new (window.AudioContext || window.webkitAudioContext)()

  // Generative ambient: layered sine oscillators with slow LFO
  const layers = [60, 80, 120, 160].map(freq => {
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    const lfo = audioCtx.createOscillator()
    const lfoGain = audioCtx.createGain()

    osc.type = 'sine'
    osc.frequency.value = freq
    lfo.frequency.value = 0.1 + Math.random() * 0.2
    lfoGain.gain.value = 3
    gain.gain.value = 0.02

    lfo.connect(lfoGain)
    lfoGain.connect(osc.frequency)
    osc.connect(gain)
    gain.connect(audioCtx.destination)

    osc.start()
    lfo.start()
    return { osc, gain }
  })

  return () => layers.forEach(({ osc }) => osc.stop())
}

export function stopAmbientAudio() {
  if (audioCtx) { audioCtx.close(); audioCtx = null }
}
```

Call `startAmbientAudio()` when entering drive mode, `stopAmbientAudio()` on exit.

---

## PHASE 13 — DEMO DATA SEEDING
### ⏱ Hour 10:30–11:30 | [C]

Seed a rich, compelling demo account BEFORE the hackathon demo. Judges need to see a city that feels alive.

### 13.1 Seed Script (`infra/seed.js`)

```js
// Run with: node infra/seed.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const BUILDINGS = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'District App',
    type: 'project',
    district: 'Work',
    rooms: [
      {
        name: 'Source Files', type: 'code',
        files: [
          { name: 'README.md', content: 'District is a spatial knowledge OS. Files live in buildings. Projects are districts. AI assistants are residents...' },
          { name: 'architecture.md', content: 'Built with React Three Fiber, Gemini 1.5 Pro, Supabase pgvector, Google Cloud Run...' },
        ]
      }
    ]
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    name: 'Machine Learning Research',
    type: 'subject',
    district: 'Research',
    rooms: [
      {
        name: 'Papers', type: 'docs',
        files: [
          { name: 'transformer-notes.md', content: 'Attention mechanisms allow models to weigh the importance of different input tokens. Transformers use self-attention to process sequences...' },
          { name: 'neural-nets.md', content: 'Neural networks are computational systems inspired by biological neurons. Deep learning uses multiple layers to learn hierarchical representations...' },
        ]
      }
    ]
  },
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    name: 'Journal',
    type: 'personal',
    district: 'Personal',
    rooms: [
      {
        name: 'Entries', type: 'notes',
        files: [
          { name: '2024-week-22.md', content: "Working on the District hackathon project this week. Thinking about how spatial metaphors could replace file systems. The city metaphor feels natural — we intuitively understand that related things live near each other..." },
        ]
      }
    ]
  }
]

// Insert into DB, then call /ai/embed for each building to generate real embeddings
async function seed() {
  for (const b of BUILDINGS) {
    // ... insert building, rooms, files
    console.log(`Seeded ${b.name}`)
    // Call embed endpoint
    await fetch(`http://localhost:3001/ai/embed`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ building_id: b.id })
    })
    console.log(`Embedded ${b.name}`)
  }
}

seed()
```

---

## PHASE 14 — POLISH + ERROR HANDLING
### ⏱ Hour 11:00–11:45 | All Hands

### 14.1 Loading States

```jsx
// src/components/city/BuildingMesh.jsx — skeleton buildings while loading
export function BuildingSkeletons() {
  return Array.from({ length: 8 }).map((_, i) => (
    <mesh key={i} position={[Math.sin(i) * 80, 10, Math.cos(i) * 80]}>
      <boxGeometry args={[12, 20, 12]} />
      <meshStandardMaterial color="#16161a" wireframe />
    </mesh>
  ))
}
```

In `CityScene.jsx`:
```jsx
const { buildings } = useCityStore()
{buildings.length === 0 ? <BuildingSkeletons /> : buildings.map(b => <BuildingMesh key={b.id} building={b} />)}
```

### 14.2 Error Boundary

```jsx
// src/components/ErrorBoundary.jsx
import { Component } from 'react'

export class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div className="w-screen h-screen flex items-center justify-center bg-[#0d0d0f] text-white">
          <div className="text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <p className="text-[#8b8a96]">Something went wrong. Refresh to continue.</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
```

### 14.3 Optimistic File Addition

When adding a note or file, show it immediately:
```js
// In DrivePanel.jsx
const addNote = async (content) => {
  const tempId = `temp-${Date.now()}`
  const optimisticFile = { id: tempId, name: 'New Note', content, mime_type: 'text/plain' }
  setFiles(f => [optimisticFile, ...f]) // Show immediately
  
  try {
    await api.uploadFile(building.id, content)
  } catch {
    setFiles(f => f.filter(x => x.id !== tempId)) // Revert on failure
    toast('Upload failed — changes reverted')
  }
}
```

### 14.4 Add Building via UI

```jsx
// Floating action button in UIOverlay
<button
  onClick={async () => {
    const name = prompt('Building name:')
    const b = await api.createBuilding({
      name, type: 'project',
      position_x: Math.random() * 100 - 50,
      position_z: Math.random() * 100 - 50,
      height: 15
    })
    useCityStore.getState().setCityData({ buildings: [...useCityStore.getState().buildings, b] })
  }}
  className="fixed bottom-20 right-4 w-12 h-12 bg-[#6c63ff] rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg hover:bg-[#7c73ff] transition-all"
>+</button>
```

---

## PHASE 15 — FINAL DEPLOYMENT + DEMO PREP
### ⏱ Hour 11:45–12:00 | [B]

### 15.1 Final Deployment Checklist

```bash
# Backend: rebuild and redeploy
gcloud builds submit --tag gcr.io/district-hackathon/district-api
gcloud run deploy district-api --image gcr.io/district-hackathon/district-api --region us-central1

# Frontend: build and deploy to Cloudflare Pages
pnpm run build
wrangler pages deploy dist --project-name=district

# Verify health
curl https://YOUR_CLOUD_RUN_URL/city

# Run seed script against production
SUPABASE_URL=... node infra/seed.js
```

### 15.2 Google Cloud Monitoring

```bash
# Enable Cloud Logging for the service
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=district-api" --limit 20

# Set up an uptime check
gcloud monitoring uptime create \
  --display-name="District API Health" \
  --resource-type=uptime-url \
  --uri="https://YOUR_CLOUD_RUN_URL/city"
```

### 15.3 Demo Account Preparation

- Log in with the pre-seeded demo account
- Verify all 3 buildings render in the city
- Confirm at least 2 skybridges exist (from seed embeddings)
- Test the Drive connection with a real folder
- Run the full demo flow once. Time it. Target: under 2 minutes.

---

## PHASE 16 — SHOW-ONLY FEATURES (Only If Ahead of Schedule)

These are visual enhancements with no functional weight for the demo. Implement LAST.

### 16.1 Advanced Sky Shader

Replace `<Sky>` from drei with `THREE.Sky` for more atmospheric control (dust, haze). Only do this if the basic sky looks bad under the demo lighting.

### 16.2 Road Splines Between Districts

```jsx
// CatmullRomCurve3 ribbon roads
function Road({ from, to }) {
  const curve = useMemo(() => new CatmullRomCurve3([
    new Vector3(from.position_x, 0.2, from.position_z),
    new Vector3((from.position_x + to.position_x) / 2, 0.2, (from.position_z + to.position_z) / 2),
    new Vector3(to.position_x, 0.2, to.position_z),
  ]), [from, to])
  const points = curve.getPoints(50)
  return (
    <mesh>
      <tubeGeometry args={[curve, 50, 2, 4, false]} />
      <meshStandardMaterial color="#1a1a22" />
    </mesh>
  )
}
```

### 16.3 Ambient Particle System (Dust/Snow)

```jsx
function CityParticles() {
  const points = useMemo(() => {
    const arr = new Float32Array(3000)
    for (let i = 0; i < 3000; i += 3) {
      arr[i] = (Math.random() - 0.5) * 400
      arr[i+1] = Math.random() * 150
      arr[i+2] = (Math.random() - 0.5) * 400
    }
    return arr
  }, [])
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.3} transparent opacity={0.3} />
    </points>
  )
}
```

### 16.4 Hover Info Card (CSS Overlay)

```jsx
// In BuildingMesh, compute screen-space position and show a mini card
function HoverCard({ building, visible }) {
  return (
    <Html position={[0, building.height + 8, 0]} center style={{ pointerEvents: 'none' }}>
      <AnimatePresence>
        {visible && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="bg-[#16161a]/90 backdrop-blur border border-white/10 rounded-xl px-3 py-2 text-xs whitespace-nowrap">
            <p className="text-white font-medium">{building.name}</p>
            <p className="text-[#8b8a96]">{building.file_count} files · {building.type}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </Html>
  )
}
```

### 16.5 Overcast + Weather Presets

Add a 5th time-of-day option (overcast) to the toolbar. Already handled in `CityLighting` configs — just add the button.

### 16.6 Skybridge Pulse Animation

When a NEW skybridge is created (detected by comparing `connections.length` between renders), animate the tube growing from one end using a `drawRange` on the `BufferGeometry` — a dramatic effect showing knowledge connections forming in real time.

### 16.7 Mobile Optimization (Cut Unless Specifically Asked)

The spec explicitly marks this as cuttable for the hackathon. Desktop-only is fine.

---

## GOOGLE CLOUD SERVICES: FULL MAP

| GCP Service | What It Does in District |
|---|---|
| **Cloud Run** | Hosts the Fastify API — serverless, auto-scales, HTTPS by default |
| **Vertex AI** | Runs Gemini 1.5 Pro and text-embedding-004 — no API key in code, uses IAM |
| **Secret Manager** | Stores Supabase keys, OAuth secrets — injected as env vars on Cloud Run |
| **Cloud Build** | CI: Docker image build and push on every git push to main |
| **Artifact Registry** | Stores Docker images for Cloud Run |
| **Cloud Storage (GCS)** | Staging area for uploaded PDFs before text extraction |
| **Pub/Sub** | Receives Google Drive push notifications → triggers re-sync webhook |
| **Cloud Logging** | Structured logs from Fastify — searchable in GCP console |
| **Cloud Monitoring** | Uptime check + latency alerting for the Cloud Run service |

---

## TEAM PARALLELIZATION GUIDE

| Hour | Person A (3D/Frontend) | Person B (Backend/GCP) | Person C (Integration) |
|---|---|---|---|
| 0:00–1:00 | Vite + Three.js scene scaffold | DB schema + Fastify skeleton | Zustand store + API client |
| 1:00–2:00 | Buildings mesh + instancing | City route + CRUD routes | Panel system skeleton |
| 2:00–3:00 | Camera + orbit controls | Cloud Run Dockerfile + deploy | Building panel + tabs |
| 3:00–4:00 | Spotlight + hover effects | Vertex AI service setup | Chat panel + streaming UI |
| 4:00–5:00 | Skybridges + grow animation | AI chat route (streaming) | Minimap + toolbar |
| 5:00–7:00 | Time-of-day transitions | Drive OAuth + sync route | Drive panel frontend |
| 7:00–9:00 | Search overlay + city highlights | Embed route + pgvector search | SearchOverlay component |
| 9:00–10:00 | Service worker + caching | Cloud Run final deploy | IndexedDB offline cache |
| 10:00–11:00 | Drive mode WASD + audio | Cloud Monitoring setup | Demo seed script |
| 11:00–12:00 | Polish: loading states, skeleton buildings | Final deploy + health check | Demo rehearsal (3×) |

---

## CRITICAL PITFALLS TO AVOID

1. **Don't call `getEmbedding()` per-file on upload** — batch them with a 1s debounce. pgvector queries are fast; the embedding generation is the bottleneck.

2. **Vertex AI cold start** — Cloud Run with `--min-instances=1` prevents cold starts during the demo. Worth the cost.

3. **Three.js memory leaks** — Call `geometry.dispose()` and `material.dispose()` in useEffect cleanup. One leaked material per building = crash after 10 minutes.

4. **Drive OAuth redirect URIs** — Add BOTH localhost:3001 and your Cloud Run URL to the OAuth client in GCP console before the hackathon.

5. **pgvector index** — The `ivfflat` index requires at least 100 rows to be effective. For a small demo dataset, remove the index and use a sequential scan (`<=> operator` without index). Add it back if you have 1000+ rows.

6. **CORS** — Update CORS on Cloud Run the moment you know your Cloudflare Pages URL. Test this FIRST after deploy.

7. **Service Worker breaks hot reload** — Disable the service worker registration in development (`if (import.meta.env.PROD) { register sw }`)

8. **Gemini streaming in Fastify** — Set `reply.hijack()` before writing raw SSE. Without this Fastify may try to finalize the response automatically.

9. **Canvas pointer events** — React Three Fiber captures ALL pointer events on the canvas. `pointer-events-none` on overlaid UI elements lets clicks pass through to the canvas where needed.

10. **Building heights from data** — Make sure `building.height` is never 0 (use `Math.max(building.height || 10, 5)`) or you'll render invisible flat boxes.

---

*Build the city. Fill it with your brain. Drive around it when you need a break.*
