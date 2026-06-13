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
          source: data.source || null,
          error: data.error || null,
          activationUrl: data.activationUrl || null,
        })
      })
      .catch(err => {
        console.error('Failed to load city data:', err)
        // Load with empty data so the scene still renders
        setCityData({
          districts: [],
          buildings: [],
          connections: [],
          error: 'Failed to load city data from the backend.',
        })
      })
  }, [setCityData])
}
