import { useEffect } from 'react'
import { useCityStore } from '../store/cityStore'
import { api } from '../lib/api'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function extractFiles(building) {
  const rooms = Array.isArray(building?.rooms) ? building.rooms : []
  return rooms
    .flatMap(room => Array.isArray(room.files) ? room.files : [])
}

function extractFileNames(building) {
  return extractFiles(building)
    .map(file => file?.name)
    .filter(Boolean)
}

function extractFileRooms(building) {
  return extractFiles(building)
    .filter(file => file?.name)
    .slice(0, 12)
    .map((file, index) => ({
      id: file.id || file.drive_file_id || `${file.name}-${index}`,
      name: file.name,
      type: file.mimeType || file.mime_type || 'file',
      url: file.webViewLink || null,
      content: file.content || '',
    }))
}

export function useCityData() {
  const setCityData = useCityStore(s => s.setCityData)
  const updateBuilding = useCityStore(s => s.updateBuilding)

  useEffect(() => {
    let cancelled = false

    api.getCity()
      .then(async data => {
        if (cancelled) return

        const buildings = data.buildings || []
        setCityData({
          districts: data.districts || [],
          buildings,
          connections: data.connections || [],
          source: data.source || null,
          error: data.error || null,
          activationUrl: data.activationUrl || null,
        })

        for (const building of buildings) {
          if (cancelled) break

          updateBuilding(building.id, { files_loading: true })

          try {
            const detail = await api.getBuilding(building.id)
            if (cancelled) break

            if (detail.error) {
              updateBuilding(building.id, {
                files_loading: false,
                files_loaded: true,
                file_names: [],
                file_count: building.file_count || 0,
              })
            } else {
              const fileNames = extractFileNames(detail)
              const fileRooms = extractFileRooms(detail)
              updateBuilding(building.id, {
                files_loading: false,
                files_loaded: true,
                file_names: fileNames.slice(0, 8),
                file_rooms: fileRooms,
                file_count: detail.file_count ?? fileNames.length,
              })
            }
          } catch (err) {
            console.error(`Failed to load files for building ${building.id}:`, err)
            if (!cancelled) {
              updateBuilding(building.id, {
                files_loading: false,
                files_loaded: true,
                file_names: [],
                file_count: building.file_count || 0,
              })
            }
          }

          await sleep(180)
        }
      })
      .catch(err => {
        if (cancelled) return
        console.error('Failed to load city data:', err)
        // Load with empty data so the scene still renders
        setCityData({
          districts: [],
          buildings: [],
          connections: [],
          error: 'Failed to load city data from the backend.',
        })
      })

    return () => {
      cancelled = true
    }
  }, [setCityData, updateBuilding])
}
