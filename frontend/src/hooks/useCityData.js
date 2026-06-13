import { useEffect } from 'react'
import { useCityStore } from '../store/cityStore'
import { api } from '../lib/api'

export function useCityData() {
  const setCityData = useCityStore(s => s.setCityData)

  useEffect(() => {
    api.getCity()
      .then(data => {
        setCityData({
          districts: data.districts || [],
          buildings: data.buildings || [],
          connections: data.connections || [],
        })
      })
      .catch(err => {
        console.error('Failed to load city data:', err)
        // Load with empty data so the scene still renders
        setCityData({ districts: [], buildings: [], connections: [] })
      })
  }, [setCityData])
}
