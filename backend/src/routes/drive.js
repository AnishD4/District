import { google } from 'googleapis'
import { supabase } from '../index.js'

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

export default async function driveRoutes(fastify) {

  // GET /drive/auth — redirect to Google OAuth
  fastify.get('/auth', async (req, reply) => {
    const oauth2Client = getOAuth2Client()
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.file',
      ],
      state: req.query.building_id,
    })
    reply.redirect(url)
  })

  // GET /drive/auth/callback
  fastify.get('/auth/callback', async (req, reply) => {
    const { code, state: buildingId } = req.query
    const oauth2Client = getOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)

    await supabase.from('buildings').update({
      drive_tokens: tokens
    }).eq('id', buildingId)

    reply.redirect(`${process.env.FRONTEND_URL}?building=${buildingId}&drive=connected`)
  })

  // GET /drive/files — list Drive files for a building
  fastify.get('/files', async (req) => {
    const { building_id } = req.query
    const { data: building } = await supabase.from('buildings')
      .select('drive_tokens, drive_folder_id').eq('id', building_id).single()
    if (!building?.drive_tokens) return { files: [], connected: false }

    const oauth2Client = getOAuth2Client()
    oauth2Client.setCredentials(building.drive_tokens)
    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    const { data } = await drive.files.list({
      q: building.drive_folder_id ? `'${building.drive_folder_id}' in parents` : undefined,
      fields: 'files(id,name,mimeType,modifiedTime,webViewLink)',
      pageSize: 50,
    })
    return { files: data.files, connected: true }
  })

  // POST /drive/sync/:building_id — sync a Drive folder to a building
  fastify.post('/sync/:building_id', async (req) => {
    const { building_id } = req.params
    const { folder_id } = req.body

    const { data: building } = await supabase.from('buildings')
      .select('drive_tokens').eq('id', building_id).single()

    const oauth2Client = getOAuth2Client()
    oauth2Client.setCredentials(building.drive_tokens)
    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    const { data: { files } } = await drive.files.list({
      q: `'${folder_id}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,modifiedTime)',
      pageSize: 100,
    })

    // Get or create default room
    let { data: room } = await supabase.from('rooms')
      .select('id').eq('building_id', building_id).eq('room_type', 'files').single()
    
    if (!room) {
      const { data: newRoom } = await supabase.from('rooms').insert({
        building_id, name: 'Drive Files', room_type: 'files'
      }).select().single()
      room = newRoom
    }

    // Sync each file
    await Promise.allSettled(files.map(async (file) => {
      let content = ''

      if (file.mimeType === 'application/vnd.google-apps.document') {
        const { data: text } = await drive.files.export({ fileId: file.id, mimeType: 'text/plain' })
        content = text
      } else if (file.mimeType.startsWith('text/')) {
        const { data: text } = await drive.files.get({ fileId: file.id, alt: 'media' })
        content = text
      }

      await supabase.from('files').upsert({
        room_id: room.id,
        name: file.name,
        content: content.slice(0, 50000),
        drive_file_id: file.id,
        mime_type: file.mimeType,
      }, { onConflict: 'drive_file_id' })
    }))

    await supabase.from('buildings').update({
      drive_folder_id: folder_id,
      file_count: files.length,
      last_updated: new Date().toISOString()
    }).eq('id', building_id)

    return { synced: files.length, folder_id }
  })

  // POST /drive/webhook — Pub/Sub push notification
  fastify.post('/webhook', async (req) => {
    const message = Buffer.from(req.body.message.data, 'base64').toString()
    const notification = JSON.parse(message)
    const { data: building } = await supabase.from('buildings')
      .select('id').eq('drive_folder_id', notification.resourceId).single()
    if (building) {
      await fastify.inject({ method: 'POST', url: `/drive/sync/${building.id}`, body: { folder_id: notification.resourceId } })
    }
    return { ok: true }
  })
}
