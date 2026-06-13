import { getEmbedding } from '../services/vertexai.js'
import { supabase } from '../index.js'

export default async function searchRoutes(fastify) {
  // GET /search?q=... — semantic search across all buildings
  fastify.get('/', async (req) => {
    const { q } = req.query
    if (!q?.trim()) return { results: [] }

    const queryEmbedding = await getEmbedding(q)

    const { data } = await supabase.rpc('semantic_search', {
      query_embedding: JSON.stringify(queryEmbedding),
      threshold: 0.70,
      limit_count: 10
    })

    return { results: data || [] }
  })
}
