import { supabase } from '../lib/supabase.js'
import { getDemoCity } from '../lib/demoData.js'
import {
  formatGoogleApiError,
  getCityDriveState,
  listDriveRootFolders,
  makeDriveCity,
  makeDriveClient,
} from '../lib/driveState.js'

export default async function cityRoutes(fastify) {
  fastify.get('/city', async (req, reply) => {
    const cityDrive = getCityDriveState()
    if (cityDrive.drive_tokens) {
      try {
        const drive = makeDriveClient(cityDrive.drive_tokens)
        const folders = await listDriveRootFolders(drive)
        return makeDriveCity(folders)
      } catch (err) {
        req.log.error(err, 'Failed to load Drive folders for city')
        return reply.code(err.code || 500).send({
          ...formatGoogleApiError(err, 'Failed to load Drive folders'),
          districts: [],
          buildings: [],
          connections: [],
        })
      }
    }

    const [districts, buildings, connections] = await Promise.all([
      supabase.from('districts').select('*'),
      supabase
        .from('buildings')
        .select('id,name,type,district_id,position_x,position_z,height,file_count,last_updated'),
      supabase.from('connections').select('building_a,building_b,strength'),
    ])

    const failed = [districts, buildings, connections].find(result => result.error)
    if (failed) {
      req.log.error(failed.error, 'Failed to fetch city data')
      return reply.code(500).send({ error: 'Failed to load city data' })
    }

    const city = {
      districts: districts.data || [],
      buildings: buildings.data || [],
      connections: connections.data || [],
    }

    if (city.buildings.length === 0) {
      return getDemoCity()
    }

    return city
  })
}
