import { supabase } from '../index.js'
import { geminiPro, getEmbedding } from '../services/vertexai.js'
import { buildBuildingContext } from '../services/contextBuilder.js'

export default async function aiRoutes(fastify) {

  // POST /ai/chat — streaming response via SSE
  fastify.post('/chat', async (req, reply) => {
    const { building_id, messages } = req.body

    const systemPrompt = await buildBuildingContext(building_id)

    // Build Gemini message history
    const geminiMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))

    const chat = geminiPro.startChat({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      history: geminiMessages.slice(0, -1)
    })

    const lastMessage = messages[messages.length - 1].content

    // Set up SSE streaming
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')

    const stream = await chat.sendMessageStream(lastMessage)
    let fullResponse = ''

    for await (const chunk of stream.stream) {
      const text = chunk.candidates[0]?.content?.parts[0]?.text || ''
      fullResponse += text
      reply.raw.write(`data: ${JSON.stringify({ text })}\n\n`)
    }

    reply.raw.write('data: [DONE]\n\n')
    reply.raw.end()

    // Save conversation after stream completes
    await supabase.from('ai_conversations').upsert({
      building_id,
      messages: [...messages, { role: 'assistant', content: fullResponse }]
    })

    // Trigger embedding update (non-blocking)
    triggerEmbeddingUpdate(building_id).catch(console.error)
  })

  // POST /ai/embed — re-embed a building and find connections
  fastify.post('/embed', async (req) => {
    const { building_id } = req.body
    return updateBuildingEmbedding(building_id)
  })
}

async function triggerEmbeddingUpdate(buildingId) {
  await new Promise(r => setTimeout(r, 2000))
  await updateBuildingEmbedding(buildingId)
}

async function updateBuildingEmbedding(buildingId) {
  const { data: building } = await supabase
    .from('buildings')
    .select(`name, rooms(files(content))`)
    .eq('id', buildingId)
    .single()

  const allText = [
    building.name,
    ...building.rooms.flatMap(r => r.files.map(f => f.content || ''))
  ].join(' ')

  if (!allText.trim()) return { connections: [] }

  const embedding = await getEmbedding(allText.slice(0, 8000))

  await supabase.from('buildings')
    .update({ embedding: JSON.stringify(embedding) })
    .eq('id', buildingId)

  // Find similar buildings using pgvector
  const { data: similar } = await supabase.rpc('find_similar_buildings', {
    query_embedding: JSON.stringify(embedding),
    exclude_id: buildingId,
    threshold: 0.82,
    limit_count: 5
  })

  // Upsert connections (skybridges)
  for (const s of (similar || [])) {
    await supabase.from('connections').upsert({
      building_a: buildingId < s.id ? buildingId : s.id,
      building_b: buildingId < s.id ? s.id : buildingId,
      strength: s.similarity
    }, { onConflict: 'building_a,building_b' })
  }

  return { connections: similar || [] }
}
