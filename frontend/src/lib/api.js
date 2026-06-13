const BASE = '/api'

function query(params = {}) {
  const clean = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')

  if (clean.length === 0) return ''
  return `?${new URLSearchParams(clean).toString()}`
}

export const api = {
  // City
  getCity: () => fetch(`${BASE}/city`).then(r => r.json()),

  // Buildings
  getBuilding: (id) => fetch(`${BASE}/buildings/${id}`).then(r => r.json()),
  createBuilding: (data) => fetch(`${BASE}/buildings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  updateBuilding: (id, data) => fetch(`${BASE}/buildings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json()),

  // AI Chat (returns raw Response for streaming)
  chat: (buildingId, messages) => fetch(`${BASE}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ building_id: buildingId, messages, stream: true })
  }),

  askFiles: async (question, context) => {
    const response = await fetch(`${BASE}/ai/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, context })
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'File AI request failed')
    }
    return data
  },

  // Embeddings
  embed: (buildingId) => fetch(`${BASE}/ai/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ building_id: buildingId })
  }).then(r => r.json()),

  // Search
  search: (q) => fetch(`${BASE}/search?q=${encodeURIComponent(q)}`).then(r => r.json()),

  // Drive
  getDriveStatus: (buildingId) => fetch(`${BASE}/drive/status${query({ building_id: buildingId })}`).then(r => r.json()),
  getDriveFiles: (buildingId) => fetch(`${BASE}/drive/files${query({ building_id: buildingId })}`).then(r => r.json()),
  importDriveFiles: (buildingId, options = {}) => fetch(`${BASE}/drive/import/${buildingId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options)
  }).then(r => r.json()),
  syncDrive: (buildingId, folderId) => fetch(`${BASE}/drive/sync/${buildingId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder_id: folderId })
  }).then(r => r.json()),
}
