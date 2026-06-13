import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })
import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import { supabase } from './lib/supabase.js'

const fastify = Fastify({ logger: true })

// Plugins
await fastify.register(cors, { origin: process.env.FRONTEND_URL || 'http://localhost:5173' })
await fastify.register(multipart)

// Routes
await fastify.register(import('./routes/city.js'), { prefix: '/' })
await fastify.register(import('./routes/buildings.js'), { prefix: '/buildings' })
await fastify.register(import('./routes/ai.js'), { prefix: '/ai' })
await fastify.register(import('./routes/drive.js'), { prefix: '/drive' })
await fastify.register(import('./routes/search.js'), { prefix: '/search' })

// Health check
fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

const port = parseInt(process.env.PORT || '3001')
await fastify.listen({ port, host: '0.0.0.0' })
console.log(`🏙️  District API running on port ${port}`)
