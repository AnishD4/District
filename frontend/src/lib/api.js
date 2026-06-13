const BASE = '/api'

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

  // Embeddings
  embed: (buildingId) => fetch(`${BASE}/ai/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ building_id: buildingId })
  }).then(r => r.json()),

  // Search
  search: (q) => fetch(`${BASE}/search?q=${encodeURIComponent(q)}`).then(r => r.json()),

  // Drive
  getDriveStatus: (buildingId) => fetch(`${BASE}/drive/status?building_id=${buildingId}`).then(r => r.json()),
  getDriveFiles: (buildingId) => fetch(`${BASE}/drive/files?building_id=${buildingId}`).then(r => r.json()),
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
