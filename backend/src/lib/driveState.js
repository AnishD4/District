import { google } from 'googleapis'
import { supabase } from './supabase.js'
import { config, getEnv } from './env.js'
import { getDemoBuilding } from './demoData.js'

export const CITY_DRIVE_STATE_ID = '__district_city_drive__'
export const DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'
export const DRIVE_DISTRICT_ID = 'drive-root-district'

export const demoDriveState = new Map()

export function isOAuthConfigured() {
  return Boolean(getEnv('GOOGLE_CLIENT_ID') && getEnv('GOOGLE_CLIENT_SECRET') && getEnv('GOOGLE_REDIRECT_URI'))
}

export function formatGoogleApiError(err, fallback) {
  const googleError = err?.response?.data?.error
  const message = googleError?.message || err?.message || fallback
  const reason = googleError?.details?.find(detail => detail.reason)?.reason
    || err?.errors?.[0]?.reason
    || null
  const activationUrl = googleError?.details?.find(detail => detail.metadata?.activationUrl)?.metadata?.activationUrl
    || err?.errors?.[0]?.extendedHelp
    || null

  return {
    error: message,
    reason,
    activationUrl,
  }
}

export function getOAuth2Client() {
  const clientId = getEnv('GOOGLE_CLIENT_ID')
  const clientSecret = getEnv('GOOGLE_CLIENT_SECRET')
  const redirectUri = getEnv('GOOGLE_REDIRECT_URI')

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth is not configured')
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

export function makeDriveClient(tokens) {
  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials(tokens)
  return google.drive({ version: 'v3', auth: oauth2Client })
}

export function getCityDriveState() {
  const state = demoDriveState.get(CITY_DRIVE_STATE_ID) || {}
  return {
    exists: true,
    demo: true,
    city: true,
    id: CITY_DRIVE_STATE_ID,
    drive_tokens: state.drive_tokens || null,
    drive_folder_id: state.drive_folder_id || null,
  }
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function getBuildingDriveState(buildingId = CITY_DRIVE_STATE_ID) {
  if (!buildingId || buildingId === CITY_DRIVE_STATE_ID) {
    return getCityDriveState()
  }

  if (isUuid(buildingId)) {
    const { data: building, error } = await supabase
      .from('buildings')
      .select('id, drive_tokens, drive_folder_id')
      .eq('id', buildingId)
      .maybeSingle()

    if (error) throw error
    if (building) {
      return { exists: true, demo: false, ...building }
    }

    if (getDemoBuilding(buildingId)) {
      const state = demoDriveState.get(buildingId) || {}
      return {
        exists: true,
        demo: true,
        id: buildingId,
        drive_tokens: state.drive_tokens || null,
        drive_folder_id: state.drive_folder_id || null,
      }
    }
  }

  const cityState = getCityDriveState()
  if (cityState.drive_tokens) {
    return {
      exists: true,
      demo: true,
      source: 'drive',
      id: buildingId,
      drive_tokens: cityState.drive_tokens,
      drive_folder_id: buildingId,
    }
  }

  return { exists: false, demo: false }
}

export async function saveDriveTokens(buildingId = CITY_DRIVE_STATE_ID, tokens) {
  if (!buildingId || buildingId === CITY_DRIVE_STATE_ID) {
    demoDriveState.set(CITY_DRIVE_STATE_ID, {
      ...(demoDriveState.get(CITY_DRIVE_STATE_ID) || {}),
      drive_tokens: tokens,
    })
    return { demo: true }
  }

  const state = await getBuildingDriveState(buildingId)
  if (!state.exists) return { error: new Error('Building not found') }

  if (state.demo) {
    demoDriveState.set(buildingId, {
      ...(demoDriveState.get(buildingId) || {}),
      drive_tokens: tokens,
    })
    return { demo: true }
  }

  return supabase
    .from('buildings')
    .update({ drive_tokens: tokens })
    .eq('id', buildingId)
}

export async function saveDemoSync(buildingId, folderId, files) {
  demoDriveState.set(buildingId, {
    ...(demoDriveState.get(buildingId) || {}),
    drive_folder_id: folderId,
    synced_files: files,
  })
}

export async function saveDemoImport(buildingId, files) {
  demoDriveState.set(buildingId, {
    ...(demoDriveState.get(buildingId) || {}),
    imported_files: files,
  })
}

function escapeDriveQueryValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export async function listDriveFiles(drive, folderId, pageSize = 50) {
  const q = folderId
    ? `'${escapeDriveQueryValue(folderId)}' in parents and trashed=false`
    : 'trashed=false'

  const { data } = await drive.files.list({
    q,
    fields: 'files(id,name,mimeType,modifiedTime,webViewLink)',
    pageSize,
    orderBy: 'folder,name',
  })

  return data.files || []
}

export async function listDriveRootFolders(drive, pageSize = 100) {
  const { data } = await drive.files.list({
    q: `'root' in parents and mimeType='${DRIVE_FOLDER_MIME_TYPE}' and trashed=false`,
    fields: 'files(id,name,mimeType,modifiedTime,webViewLink)',
    pageSize,
    orderBy: 'name',
  })

  return data.files || []
}

export async function getDriveFolderMetadata(drive, folderId) {
  const { data } = await drive.files.get({
    fileId: folderId,
    fields: 'id,name,mimeType,modifiedTime,webViewLink',
  })

  if (data.mimeType !== DRIVE_FOLDER_MIME_TYPE) {
    return null
  }

  return data
}

export function makeDriveCity(folders) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(folders.length || 1)))
  const rows = Math.max(1, Math.ceil((folders.length || 1) / columns))
  const spacing = 42

  return {
    districts: [{
      id: DRIVE_DISTRICT_ID,
      name: 'Google Drive',
      color: '#6c63ff',
      position_x: 0,
      position_z: 0,
      radius: Math.max(80, Math.max(columns, rows) * spacing),
    }],
    buildings: folders.map((folder, index) => {
      const col = index % columns
      const row = Math.floor(index / columns)

      return {
        id: folder.id,
        district_id: DRIVE_DISTRICT_ID,
        name: folder.name,
        type: 'project',
        position_x: (col - (columns - 1) / 2) * spacing,
        position_z: (row - (rows - 1) / 2) * spacing,
        height: 16 + (index % 5) * 4,
        file_count: 0,
        last_updated: folder.modifiedTime,
        drive_folder_id: folder.id,
        drive_web_url: folder.webViewLink,
        source: 'drive',
        demo: true,
      }
    }),
    connections: [],
    source: 'drive',
  }
}

export function getFrontendDriveRedirect(buildingId) {
  const params = new URLSearchParams({ drive: 'connected' })
  if (buildingId && buildingId !== CITY_DRIVE_STATE_ID) {
    params.set('building', buildingId)
  }

  try {
    const target = new URL(config.frontendUrl)
    const basePath = target.pathname === '/' ? '' : target.pathname.replace(/\/$/, '')
    target.pathname = `${basePath}/city`
    target.search = params.toString()
    return target.toString()
  } catch {
    return `/city?${params.toString()}`
  }
}
