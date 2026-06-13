import { getEmbedding } from '../services/vertexai.js'
import { supabase } from '../lib/supabase.js'

export default async function searchRoutes(fastify) {
  fastify.get('/', async (req, reply) => {
    const { q } = req.query
    if (!q?.trim()) return { results: [] }

    let queryEmbedding
    try {
      queryEmbedding = await getEmbedding(q)
    } catch (err) {
      req.log.error(err, 'Failed to generate search embedding')
      return reply.code(503).send({ error: 'Search AI service is unavailable', results: [] })
    }

    const { data, error } = await supabase.rpc('semantic_search', {
      query_embedding: JSON.stringify(queryEmbedding),
      threshold: 0.70,
      limit_count: 10,
    })

    if (error) {
      req.log.error(error, 'Semantic search RPC failed')
      return reply.code(500).send({ error: 'Search failed', results: [] })
    }

    return { results: data || [] }
  })
}
