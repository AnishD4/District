import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(__dirname, '../..')
const projectRoot = path.resolve(backendDir, '..')

const envCandidates = [
  { path: path.join(projectRoot, '.env'), label: 'project root .env' },
  { path: path.join(backendDir, '.env'), label: 'backend/.env' },
]

const loadedEnvFiles = []

for (const candidate of envCandidates) {
  if (!fs.existsSync(candidate.path)) continue

  dotenv.config({
    path: candidate.path,
    override: candidate.path.endsWith(`${path.sep}backend${path.sep}.env`),
  })
  loadedEnvFiles.push(candidate.label)
}

export const envSources = loadedEnvFiles

export function getEnv(name, fallback = undefined) {
  const value = process.env[name]
  return value === undefined || value === '' ? fallback : value
}

export function requireEnv(name) {
  const value = getEnv(name)
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function trimTrailingSlash(value) {
  return typeof value === 'string' ? value.replace(/\/+$/, '') : value
}

export function getFrontendOrigins() {
  const configured = getEnv('FRONTEND_URL', 'http://localhost:5173')
  return configured
    .split(',')
    .map(origin => trimTrailingSlash(origin.trim()))
    .filter(Boolean)
}

export const config = {
  port: Number.parseInt(getEnv('PORT', '3001'), 10),
  frontendUrl: trimTrailingSlash(getEnv('FRONTEND_URL', 'http://localhost:5173')),
  apiUrl: trimTrailingSlash(getEnv('API_URL', 'http://localhost:3001')),
}
