import { supabase } from '../lib/supabase.js'
import { getDemoBuilding } from '../lib/demoData.js'
import {
  DRIVE_DISTRICT_ID,
  DRIVE_FOLDER_MIME_TYPE,
  formatGoogleApiError,
  getCityDriveState,
  getDriveFolderMetadata,
  listDriveFiles,
  makeDriveClient,
} from '../lib/driveState.js'

const BUILDING_TYPES = new Set(['project', 'subject', 'personal', 'work'])
const ROOM_TYPES = new Set(['files', 'notes', 'code', 'docs', 'chat'])

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function cleanBuildingPayload(body = {}) {
  const payload = {}

  if (typeof body.name === 'string' && body.name.trim()) payload.name = body.name.trim()
  if (BUILDING_TYPES.has(body.type)) payload.type = body.type
  if (typeof body.district_id === 'string' && body.district_id.trim()) payload.district_id = body.district_id
  if (Number.isFinite(body.position_x)) payload.position_x = body.position_x
  if (Number.isFinite(body.position_z)) payload.position_z = body.position_z
  if (Number.isFinite(body.height) && body.height > 0) payload.height = body.height

  return payload
}

async function getOrCreateFilesRoom(buildingId, roomName = 'Files') {
  const { data: room } = await supabase
    .from('rooms')
    .select('id')
    .eq('building_id', buildingId)
    .eq('room_type', 'files')
    .maybeSingle()

  if (room) return room

  const { data: newRoom, error } = await supabase
    .from('rooms')
    .insert({ building_id: buildingId, name: roomName, room_type: 'files' })
    .select('id')
    .single()

  if (error || !newRoom) {
    throw new Error(error?.message || 'Failed to create files room')
  }

  return newRoom
}

async function getDriveFolderBuilding(folderId) {
  const cityDrive = getCityDriveState()
  if (!cityDrive.drive_tokens) return null

  const drive = makeDriveClient(cityDrive.drive_tokens)
  const folder = await getDriveFolderMetadata(drive, folderId)
  if (!folder) return null

  const files = await listDriveFiles(drive, folder.id, 100)
  const visibleFiles = files.map(file => ({
    id: file.id,
    room_id: `drive-room-${folder.id}`,
    name: file.name,
    content: '',
    drive_file_id: file.id,
    mime_type: file.mimeType,
    mimeType: file.mimeType,
    webViewLink: file.webViewLink,
    modifiedTime: file.modifiedTime,
  }))

  return {
    id: folder.id,
    district_id: DRIVE_DISTRICT_ID,
    name: folder.name,
    type: 'project',
    position_x: 0,
    position_z: 0,
    height: 18,
    file_count: files.filter(file => file.mimeType !== DRIVE_FOLDER_MIME_TYPE).length,
    last_updated: folder.modifiedTime,
    drive_folder_id: folder.id,
    drive_web_url: folder.webViewLink,
    source: 'drive',
    demo: true,
    rooms: [{
      id: `drive-room-${folder.id}`,
      building_id: folder.id,
      name: 'Drive Files',
      room_type: 'files',
      files: visibleFiles,
    }],
  }
}

export default async function buildingRoutes(fastify) {
  fastify.get('/:id', async (req, reply) => {
    const demoBuilding = getDemoBuilding(req.params.id)
    if (demoBuilding) return demoBuilding

    if (!isUuid(req.params.id)) {
      try {
        const driveBuilding = await getDriveFolderBuilding(req.params.id)
        if (driveBuilding) return driveBuilding
      } catch (err) {
        req.log.error(err, 'Failed to load Drive folder building')
        return reply.code(err.code || 500).send(formatGoogleApiError(err, 'Failed to load Drive folder'))
      }

      return reply.code(404).send({ error: 'Building not found' })
    }

    const { data, error } = await supabase
      .from('buildings')
      .select('*, rooms(*, files(*))')
      .eq('id', req.params.id)
      .single()

    if (error || !data) {
      return reply.code(404).send({ error: 'Building not found' })
    }
    return data
  })

  fastify.post('/', async (req, reply) => {
    const payload = cleanBuildingPayload(req.body)
    if (!payload.name) {
      return reply.code(400).send({ error: 'name is required' })
    }

    payload.type ||= 'project'
    payload.position_x ??= 0
    payload.position_z ??= 0
    payload.height ??= 10

    const { data, error } = await supabase
      .from('buildings')
      .insert(payload)
      .select()
      .single()

    if (error) {
      req.log.error(error, 'Failed to create building')
      return reply.code(400).send({ error: error.message })
    }

    const { error: roomError } = await supabase.from('rooms').insert({
      building_id: data.id,
      name: 'Files',
      room_type: 'files',
    })

    if (roomError) {
      req.log.error(roomError, 'Failed to create default files room')
    }

    return reply.code(201).send(data)
  })

  fastify.patch('/:id', async (req, reply) => {
    const payload = cleanBuildingPayload(req.body)
    delete payload.name
    if (typeof req.body?.name === 'string' && req.body.name.trim()) {
      payload.name = req.body.name.trim()
    }

    if (req.body?.type !== undefined && !BUILDING_TYPES.has(req.body.type)) {
      return reply.code(400).send({ error: 'Invalid building type' })
    }

    if (Object.keys(payload).length === 0) {
      return reply.code(400).send({ error: 'No valid fields to update' })
    }

    payload.last_updated = new Date().toISOString()

    const { data, error } = await supabase
      .from('buildings')
      .update(payload)
      .eq('id', req.params.id)
      .select()
      .single()

    if (error || !data) {
      return reply.code(404).send({ error: 'Building not found or update failed' })
    }
    return data
  })

  fastify.delete('/:id', async (req, reply) => {
    const { error } = await supabase.from('buildings').delete().eq('id', req.params.id)
    if (error) {
      req.log.error(error, 'Failed to delete building')
      return reply.code(500).send({ error: 'Failed to delete building' })
    }
    return { ok: true }
  })

  fastify.post('/:id/files', async (req, reply) => {
    let fileData
    try {
      fileData = await req.file()
    } catch {
      return reply.code(400).send({ error: 'No file provided or file too large' })
    }

    if (!fileData) {
      return reply.code(400).send({ error: 'No file provided' })
    }

    const room = await getOrCreateFilesRoom(req.params.id)
    const buffer = await fileData.toBuffer()
    const content = buffer.toString('utf-8')

    const { data: file, error } = await supabase
      .from('files')
      .insert({
        room_id: room.id,
        name: fileData.filename,
        content,
        mime_type: fileData.mimetype,
      })
      .select()
      .single()

    if (error) {
      req.log.error(error, 'Failed to save file')
      return reply.code(500).send({ error: 'Failed to save file' })
    }

    supabase.rpc('increment_file_count', { building_id: req.params.id }).then(({ error: rpcError }) => {
      if (rpcError) req.log.error(rpcError, 'Failed to increment file count')
    })

    return file
  })

  fastify.post('/:id/rooms', async (req, reply) => {
    const { name, room_type } = req.body || {}
    if (!name?.trim()) {
      return reply.code(400).send({ error: 'name is required' })
    }

    const { data, error } = await supabase
      .from('rooms')
      .insert({
        building_id: req.params.id,
        name: name.trim(),
        room_type: ROOM_TYPES.has(room_type) ? room_type : 'files',
      })
      .select()
      .single()

    if (error) {
      req.log.error(error, 'Failed to create room')
      return reply.code(400).send({ error: error.message })
    }

    return reply.code(201).send(data)
  })
}
