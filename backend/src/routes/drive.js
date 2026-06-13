import { supabase } from '../lib/supabase.js'
import { getEnv } from '../lib/env.js'
import {
  CITY_DRIVE_STATE_ID,
  formatGoogleApiError,
  getBuildingDriveState,
  getFrontendDriveRedirect,
  getOAuth2Client,
  isOAuthConfigured,
  listDriveFiles,
  makeDriveClient,
  saveDemoImport,
  saveDemoSync,
  saveDriveTokens,
} from '../lib/driveState.js'

const IMPORTABLE_MIME_TYPES = new Set([
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
])

async function getFilesRoom(buildingId) {
  const { data: room } = await supabase
    .from('rooms')
    .select('id')
    .eq('building_id', buildingId)
    .eq('room_type', 'files')
    .maybeSingle()

  if (room) return room

  const { data: newRoom, error } = await supabase
    .from('rooms')
    .insert({ building_id: buildingId, name: 'Drive Files', room_type: 'files' })
    .select('id')
    .single()

  if (error || !newRoom) {
    throw new Error(error?.message || 'Failed to create Drive files room')
  }

  return newRoom
}

function isImportableFile(file) {
  return IMPORTABLE_MIME_TYPES.has(file.mimeType) || file.mimeType?.startsWith('text/')
}

async function extractDriveFileContent(drive, file) {
  if (file.mimeType === 'application/vnd.google-apps.document') {
    const { data } = await drive.files.export({ fileId: file.id, mimeType: 'text/plain' })
    return typeof data === 'string' ? data : ''
  }

  if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
    const { data } = await drive.files.export({ fileId: file.id, mimeType: 'text/csv' })
    return typeof data === 'string' ? data : ''
  }

  if (file.mimeType === 'application/vnd.google-apps.presentation') {
    const { data } = await drive.files.export({ fileId: file.id, mimeType: 'text/plain' })
    return typeof data === 'string' ? data : ''
  }

  if (file.mimeType?.startsWith('text/')) {
    const { data } = await drive.files.get({ fileId: file.id, alt: 'media' })
    return typeof data === 'string' ? data : ''
  }

  return ''
}

async function importDriveFiles({ drive, files, buildingId, demo, log }) {
  const candidates = files.filter(isImportableFile)
  const imported = []
  const skipped = files.length - candidates.length
  let failed = 0

  for (const file of candidates) {
    try {
      const content = await extractDriveFileContent(drive, file)
      if (!content.trim()) {
        failed += 1
        continue
      }

      imported.push({
        id: file.id,
        name: file.name,
        content: content.slice(0, 50000),
        drive_file_id: file.id,
        mime_type: file.mimeType,
        webViewLink: file.webViewLink,
        modifiedTime: file.modifiedTime,
      })
    } catch (err) {
      failed += 1
      log.warn({ err, fileId: file.id, fileName: file.name }, 'Failed to import Drive file')
    }
  }

  if (demo) {
    await saveDemoImport(buildingId, imported)
    return { imported: imported.length, failed, skipped, files: imported, demo: true }
  }

  const room = await getFilesRoom(buildingId)
  const results = await Promise.allSettled(imported.map(file => (
    supabase.from('files').upsert({
      room_id: room.id,
      name: file.name,
      content: file.content,
      drive_file_id: file.drive_file_id,
      mime_type: file.mime_type,
    }, { onConflict: 'drive_file_id' })
  )))

  const writeFailures = results.filter(result => result.status === 'rejected' || result.value?.error).length

  await supabase
    .from('buildings')
    .update({
      file_count: imported.length,
      last_updated: new Date().toISOString(),
    })
    .eq('id', buildingId)

  return { imported: imported.length - writeFailures, failed: failed + writeFailures, skipped, files: imported }
}

export default async function driveRoutes(fastify) {
  fastify.get('/status', async (req, reply) => {
    const { building_id: buildingId = CITY_DRIVE_STATE_ID } = req.query
    let building

    try {
      building = await getBuildingDriveState(buildingId)
    } catch (err) {
      req.log.error(err, 'Failed to read Drive status')
      return reply.code(500).send({ error: 'Failed to read Drive status' })
    }

    return {
      configured: isOAuthConfigured(),
      connected: Boolean(building.drive_tokens),
      exists: building.exists,
      demo: building.demo,
      city: Boolean(building.city),
      source: building.source || null,
      folder_id: building.drive_folder_id || null,
      redirectUri: getEnv('GOOGLE_REDIRECT_URI', null),
    }
  })

  fastify.get('/auth', async (req, reply) => {
    const { building_id: buildingId = CITY_DRIVE_STATE_ID } = req.query

    const building = await getBuildingDriveState(buildingId)
    if (!building.exists) {
      return reply.code(404).send({ error: 'Building not found' })
    }

    let oauth2Client
    try {
      oauth2Client = getOAuth2Client()
    } catch (err) {
      return reply.code(503).send({ error: err.message })
    }

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/drive.readonly',
      ],
      state: buildingId,
    })

    return reply.redirect(url)
  })

  fastify.get('/auth/callback', async (req, reply) => {
    const { code, state: buildingId = CITY_DRIVE_STATE_ID } = req.query
    if (!code || !buildingId) {
      return reply.code(400).send({ error: 'code and state are required' })
    }

    let oauth2Client
    try {
      oauth2Client = getOAuth2Client()
    } catch (err) {
      return reply.code(503).send({ error: err.message })
    }

    let tokens
    try {
      const result = await oauth2Client.getToken(code)
      tokens = result.tokens
    } catch (err) {
      req.log.error(err, 'Failed to exchange Google OAuth code')
      return reply.code(400).send({ error: 'Failed to authenticate with Google Drive' })
    }

    const { error } = await saveDriveTokens(buildingId, tokens)
    if (error) {
      req.log.error(error, 'Failed to save Drive tokens')
      return reply.code(500).send({ error: 'Failed to save Drive authentication' })
    }

    return reply.redirect(getFrontendDriveRedirect(buildingId))
  })

  fastify.get('/files', async (req, reply) => {
    const { building_id: buildingId } = req.query
    if (!buildingId) {
      return reply.code(400).send({ error: 'building_id is required', files: [], connected: false })
    }

    let building
    try {
      building = await getBuildingDriveState(buildingId)
    } catch (err) {
      req.log.error(err, 'Failed to read building Drive state')
      return reply.code(500).send({ error: 'Failed to read Drive state', files: [], connected: false })
    }

    if (!building.exists) {
      return reply.code(404).send({ error: 'Building not found', files: [], connected: false })
    }

    if (!building.drive_tokens) {
      return {
        files: [],
        connected: false,
        configured: isOAuthConfigured(),
        demo: building.demo,
      }
    }

    let drive
    try {
      drive = makeDriveClient(building.drive_tokens)
    } catch (err) {
      return reply.code(503).send({ error: err.message, files: [], connected: false })
    }

    try {
      const files = await listDriveFiles(drive, building.drive_folder_id)
      return {
        files,
        connected: true,
        configured: true,
        demo: building.demo,
        folder_id: building.drive_folder_id,
      }
    } catch (err) {
      req.log.error(err, 'Drive API list failed')
      return reply.code(err.code || 500).send({
        ...formatGoogleApiError(err, 'Failed to list Drive files'),
        files: [],
        connected: true,
      })
    }
  })

  fastify.post('/sync/:building_id', async (req, reply) => {
    const { building_id: buildingId } = req.params
    const { folder_id: folderId } = req.body || {}

    if (!folderId) {
      return reply.code(400).send({ error: 'folder_id is required' })
    }

    const building = await getBuildingDriveState(buildingId)
    if (!building.exists) {
      return reply.code(404).send({ error: 'Building not found' })
    }

    if (!building.drive_tokens) {
      return reply.code(400).send({ error: 'Drive not connected for this building' })
    }

    let drive
    try {
      drive = makeDriveClient(building.drive_tokens)
    } catch (err) {
      return reply.code(503).send({ error: err.message })
    }

    let files
    try {
      files = await listDriveFiles(drive, folderId, 100)
    } catch (err) {
      req.log.error(err, 'Drive folder list failed')
      return reply.code(err.code || 500).send(formatGoogleApiError(err, 'Failed to read Drive folder'))
    }

    if (building.demo) {
      await saveDemoSync(buildingId, folderId, files)
      return { synced: files.length, failed: 0, total: files.length, folder_id: folderId, demo: true }
    }

    const room = await getFilesRoom(buildingId)

    const results = await Promise.allSettled(files.map(async file => {
      let content = ''

      try {
        if (file.mimeType === 'application/vnd.google-apps.document') {
          const { data } = await drive.files.export({ fileId: file.id, mimeType: 'text/plain' })
          content = typeof data === 'string' ? data : ''
        } else if (file.mimeType?.startsWith('text/')) {
          const { data } = await drive.files.get({ fileId: file.id, alt: 'media' })
          content = typeof data === 'string' ? data : ''
        }
      } catch (err) {
        req.log.warn({ err, fileId: file.id }, 'Failed to extract Drive file content')
      }

      const { error } = await supabase.from('files').upsert({
        room_id: room.id,
        name: file.name,
        content: content.slice(0, 50000),
        drive_file_id: file.id,
        mime_type: file.mimeType,
      }, { onConflict: 'drive_file_id' })

      if (error) throw error
    }))

    const failed = results.filter(result => result.status === 'rejected').length
    const synced = results.length - failed

    const { error: updateError } = await supabase
      .from('buildings')
      .update({
        drive_folder_id: folderId,
        file_count: files.length,
        last_updated: new Date().toISOString(),
      })
      .eq('id', buildingId)

    if (updateError) {
      req.log.error(updateError, 'Failed to update Drive sync metadata')
    }

    return { synced, failed, total: files.length, folder_id: folderId }
  })

  fastify.post('/import/:building_id', async (req, reply) => {
    const { building_id: buildingId } = req.params
    const { folder_id: folderId = null, limit = 25 } = req.body || {}

    const building = await getBuildingDriveState(buildingId)
    if (!building.exists) {
      return reply.code(404).send({ error: 'Building not found' })
    }

    if (!building.drive_tokens) {
      return reply.code(400).send({ error: 'Connect Google Drive before importing files' })
    }

    let drive
    try {
      drive = makeDriveClient(building.drive_tokens)
    } catch (err) {
      return reply.code(503).send({ error: err.message })
    }

    let files
    try {
      files = await listDriveFiles(drive, folderId || building.drive_folder_id, Math.min(Number(limit) || 25, 100))
    } catch (err) {
      req.log.error(err, 'Drive file list failed before import')
      return reply.code(err.code || 500).send(formatGoogleApiError(err, 'Failed to read Drive files'))
    }

    const result = await importDriveFiles({
      drive,
      files,
      buildingId,
      demo: building.demo,
      log: req.log,
    })

    return {
      ...result,
      total: files.length,
      folder_id: folderId || building.drive_folder_id || null,
    }
  })

  fastify.post('/webhook', async (req, reply) => {
    try {
      if (!req.body?.message?.data) {
        return reply.code(400).send({ error: 'Invalid Pub/Sub message' })
      }

      const message = Buffer.from(req.body.message.data, 'base64').toString()
      const notification = JSON.parse(message)

      const { data: building } = await supabase
        .from('buildings')
        .select('id')
        .eq('drive_folder_id', notification.resourceId)
        .maybeSingle()

      if (building) {
        fastify.inject({
          method: 'POST',
          url: `/drive/sync/${building.id}`,
          payload: { folder_id: notification.resourceId },
        }).catch(err => req.log.error(err, 'Drive webhook sync failed'))
      }

      return { ok: true }
    } catch (err) {
      req.log.error(err, 'Drive webhook processing failed')
      return { ok: true }
    }
  })
}
