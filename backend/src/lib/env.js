import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendEnvPath = path.resolve(__dirname, '../../.env')
const rootEnvPath = path.resolve(__dirname, '../../../.env')

for (const envPath of [rootEnvPath, backendEnvPath]) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: envPath === backendEnvPath })
  }
}

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
