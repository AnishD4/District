const now = new Date().toISOString()

export const demoDistricts = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Work',
    color: '#6c63ff',
    position_x: -80,
    position_z: 0,
    radius: 60,
    created_at: now,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Research',
    color: '#ff6b6b',
    position_x: 80,
    position_z: 0,
    radius: 60,
    created_at: now,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Personal',
    color: '#4ecdc4',
    position_x: 0,
    position_z: 120,
    radius: 50,
    created_at: now,
  },
]

export const demoBuildings = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    district_id: '11111111-1111-1111-1111-111111111111',
    name: 'District App',
    type: 'project',
    position_x: -80,
    position_z: 0,
    height: 25,
    file_count: 2,
    last_updated: now,
    created_at: now,
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    district_id: '22222222-2222-2222-2222-222222222222',
    name: 'Machine Learning',
    type: 'subject',
    position_x: 80,
    position_z: 0,
    height: 20,
    file_count: 2,
    last_updated: now,
    created_at: now,
  },
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    district_id: '33333333-3333-3333-3333-333333333333',
    name: 'Journal',
    type: 'personal',
    position_x: 0,
    position_z: 120,
    height: 15,
    file_count: 1,
    last_updated: now,
    created_at: now,
  },
]

export const demoConnections = [
  {
    building_a: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    building_b: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    strength: 0.78,
  },
  {
    building_a: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    building_b: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    strength: 0.54,
  },
]

const demoRoomsByBuilding = {
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': [
    {
      id: 'room-aaaaaaaa-files',
      building_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      name: 'Source Files',
      room_type: 'code',
      files: [
        {
          id: 'file-district-readme',
          room_id: 'room-aaaaaaaa-files',
          name: 'README.md',
          content: 'District is a spatial knowledge OS. Files live in buildings. Projects become districts. AI assistants live inside buildings.',
          mime_type: 'text/markdown',
          created_at: now,
        },
        {
          id: 'file-district-architecture',
          room_id: 'room-aaaaaaaa-files',
          name: 'architecture.md',
          content: 'Built with React Three Fiber, Fastify, Gemini, Supabase pgvector, and Google Drive sync.',
          mime_type: 'text/markdown',
          created_at: now,
        },
      ],
    },
  ],
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb': [
    {
      id: 'room-bbbbbbbb-files',
      building_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      name: 'Papers',
      room_type: 'docs',
      files: [
        {
          id: 'file-transformer-notes',
          room_id: 'room-bbbbbbbb-files',
          name: 'transformer-notes.md',
          content: 'Attention mechanisms let models weigh relationships between tokens. Transformers use self-attention to process sequences.',
          mime_type: 'text/markdown',
          created_at: now,
        },
        {
          id: 'file-neural-nets',
          room_id: 'room-bbbbbbbb-files',
          name: 'neural-nets.md',
          content: 'Neural networks learn layered representations from data and are the foundation for modern deep learning systems.',
          mime_type: 'text/markdown',
          created_at: now,
        },
      ],
    },
  ],
  'cccccccc-cccc-cccc-cccc-cccccccccccc': [
    {
      id: 'room-cccccccc-files',
      building_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      name: 'Entries',
      room_type: 'notes',
      files: [
        {
          id: 'file-journal-week',
          room_id: 'room-cccccccc-files',
          name: '2026-week-notes.md',
          content: 'Working on District this week. The city metaphor makes project relationships easier to inspect and remember.',
          mime_type: 'text/markdown',
          created_at: now,
        },
      ],
    },
  ],
}

export function getDemoCity() {
  return {
    districts: demoDistricts,
    buildings: demoBuildings,
    connections: demoConnections,
    demo: true,
  }
}

export function getDemoBuilding(id) {
  const building = demoBuildings.find(item => item.id === id)
  if (!building) return null
  return {
    ...building,
    rooms: demoRoomsByBuilding[id] || [],
    demo: true,
  }
}
