import { supabase } from '../index.js'

// GET /city — returns full city state (districts, buildings, connections)
export default async function cityRoutes(fastify) {
  fastify.get('/city', async (req, reply) => {
    const [districts, buildings, connections] = await Promise.all([
      supabase.from('districts').select('*'),
      supabase.from('buildings').select('id,name,type,district_id,position_x,position_z,height,file_count,last_updated'),
      supabase.from('connections').select('building_a,building_b,strength'),
    ])
    return {
      districts: districts.data || [],
      buildings: buildings.data || [],
      connections: connections.data || [],
    }
  })
}
