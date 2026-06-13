import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import { supabase, supabaseAuthMode } from './lib/supabase.js'
import { config, envSources, getEnv, getFrontendOrigins, trimTrailingSlash } from './lib/env.js'
import { isOAuthConfigured } from './lib/driveState.js'

const fastify = Fastify({
  logger: true,
  bodyLimit: 10 * 1024 * 1024,
})

const allowedOrigins = getFrontendOrigins()

await fastify.register(cors, {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(trimTrailingSlash(origin))) {
      callback(null, true)
      return
    }
    callback(new Error('Not allowed by CORS'), false)
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
})

await fastify.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
})

fastify.setErrorHandler((error, request, reply) => {
  request.log.error(error)
  const statusCode = error.statusCode || 500
  reply.code(statusCode).send({
    error: error.message || 'Internal Server Error',
    statusCode,
  })
})

await fastify.register(import('./routes/city.js'), { prefix: '/' })
await fastify.register(import('./routes/buildings.js'), { prefix: '/buildings' })
await fastify.register(import('./routes/ai.js'), { prefix: '/ai' })
await fastify.register(import('./routes/drive.js'), { prefix: '/drive' })
await fastify.register(import('./routes/search.js'), { prefix: '/search' })

fastify.get('/', async () => ({
  name: 'District API',
  status: 'ok',
  endpoints: {
    health: '/health',
    city: '/city',
    buildings: '/buildings/:id',
    aiChat: '/ai/chat',
    aiEmbed: '/ai/embed',
    driveAuth: '/drive/auth',
    search: '/search?q=...',
  },
}))

fastify.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  services: {
    supabase: Boolean(supabase),
    supabaseAuthMode,
    gemini: Boolean(process.env.GEMINI_API_KEY),
    drive: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  },
}))

fastify.setNotFoundHandler((request, reply) => {
  reply.code(404).send({
    error: 'Not Found',
    message: `Route ${request.method}:${request.url} not found`,
    statusCode: 404,
    availableEndpoints: ['/', '/health', '/city', '/buildings/:id', '/ai/chat', '/ai/embed', '/drive/auth', '/search'],
  })
})

try {
  await fastify.listen({ port: config.port, host: '0.0.0.0' })
  console.log(`District API running on port ${config.port}`)
  if (envSources.length > 0) {
    console.log(`Loaded env from: ${envSources.join(', ')}`)
  } else {
    console.warn('No .env file found. Copy backend/.env.example to backend/.env or add a .env at the project root.')
  }
  console.log(`Google Drive OAuth: ${isOAuthConfigured() ? 'configured' : 'NOT configured'}`)
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
