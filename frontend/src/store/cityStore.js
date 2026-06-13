import { create } from 'zustand'

export const useCityStore = create((set, get) => ({
  // City data
  districts: [],
  buildings: [],
  connections: [],
  citySource: null,
  cityError: null,
  cityActivationUrl: null,

  // Selection state
  hoveredBuilding: null,
  selectedBuilding: null,

  // Camera mode
  cameraMode: 'orbit', // 'orbit' | 'drive' | 'interior'

  // UI state
  activePanels: [],        // ['building', 'drive', 'chat']
  timeOfDay: 'night',      // 'dawn' | 'day' | 'dusk' | 'night' | 'overcast'
  searchQuery: '',
  searchResults: [],
  loading: true,

  // Actions
  setCityData: (data) => set({
    ...data,
    citySource: data.source || null,
    cityError: data.error || null,
    cityActivationUrl: data.activationUrl || null,
    loading: false,
  }),
  setHoveredBuilding: (id) => set({ hoveredBuilding: id }),
  setSelectedBuilding: (id) => set({ selectedBuilding: id }),
  setCameraMode: (mode) => set({ cameraMode: mode }),
  setTimeOfDay: (preset) => set({ timeOfDay: preset }),
  openPanel: (panel) => set((s) => ({ activePanels: [...new Set([...s.activePanels, panel])] })),
  closePanel: (panel) => set((s) => ({ activePanels: s.activePanels.filter(p => p !== panel) })),
  setSearchResults: (results) => set({ searchResults: results }),

  // Add a building to the store (optimistic UI)
  addBuilding: (building) => set((s) => ({ buildings: [...s.buildings, building] })),
  updateBuilding: (id, updates) => set((s) => ({
    buildings: s.buildings.map(b => b.id === id ? { ...b, ...updates } : b)
  })),
}))
