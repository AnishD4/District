import { supabase } from '../index.js'

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

  // DELETE /buildings/:id
  fastify.delete('/:id', async (req) => {
    await supabase.from('buildings').delete().eq('id', req.params.id)
    return { ok: true }
  })

  // POST /buildings/:id/files — upload a file
  fastify.post('/:id/files', async (req, reply) => {
    const data = await req.file()
    const buffer = await data.toBuffer()
    const content = buffer.toString('utf-8')
    const { data: room } = await supabase.from('rooms')
      .select('id').eq('building_id', req.params.id).eq('room_type', 'files').single()
    
    if (!room) {
      // Auto-create a files room if it doesn't exist
      const { data: newRoom } = await supabase.from('rooms').insert({
        building_id: req.params.id, name: 'Files', room_type: 'files'
      }).select().single()
      var roomId = newRoom.id
    } else {
      var roomId = room.id
    }

    const { data: file } = await supabase.from('files').insert({
      room_id: roomId, name: data.filename, content, mime_type: data.mimetype
    }).select().single()

    // Increment file count
    await supabase.rpc('increment_file_count', { building_id: req.params.id })
    return file
  })
}
