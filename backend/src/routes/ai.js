import { supabase } from '../lib/supabase.js'
import { getGeminiPro, getEmbedding } from '../services/vertexai.js'
import { buildBuildingContext } from '../services/contextBuilder.js'
import { config } from '../lib/env.js'

export default async function aiRoutes(fastify) {
  fastify.post('/chat', async (req, reply) => {
    const { building_id: buildingId, messages } = req.body || {}

    if (!buildingId || !Array.isArray(messages) || messages.length === 0) {
      return reply.code(400).send({ error: 'building_id and messages[] are required' })
    }

    const lastMessage = messages[messages.length - 1]
    if (!lastMessage?.content?.trim()) {
      return reply.code(400).send({ error: 'Last message content is required' })
    }

    let systemPrompt
    try {
      systemPrompt = await buildBuildingContext(buildingId)
    } catch (err) {
      req.log.error(err, 'Failed to build building context')
      return reply.code(404).send({ error: 'Building not found' })
    }

    let stream
    try {
      const chat = getGeminiPro().startChat({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        history: messages.slice(0, -1).map(message => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(message.content || '') }],
        })),
      })
      stream = await chat.sendMessageStream(lastMessage.content)
    } catch (err) {
      req.log.error(err, 'Failed to start Gemini chat stream')
      return reply.code(503).send({ error: 'AI service failed to start' })
    }

    reply.hijack()
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': config.frontendUrl || '*',
    })

    let fullResponse = ''
    try {
      for await (const chunk of stream.stream) {
        const text = typeof chunk.text === 'function'
          ? chunk.text()
          : chunk.candidates?.[0]?.content?.parts?.[0]?.text || ''

        if (!text) continue
        fullResponse += text
        reply.raw.write(`data: ${JSON.stringify({ text })}\n\n`)
      }
    } catch (err) {
      req.log.error(err, 'Gemini streaming error')
      reply.raw.write(`data: ${JSON.stringify({ error: 'AI generation failed' })}\n\n`)
    } finally {
      reply.raw.write('data: [DONE]\n\n')
      reply.raw.end()
    }

    if (fullResponse) {
      supabase
        .from('ai_conversations')
        .insert({
          building_id: buildingId,
          messages: [...messages, { role: 'assistant', content: fullResponse }],
        })
        .then(({ error }) => {
          if (error) req.log.error(error, 'Failed to save conversation')
        })
    }

    triggerEmbeddingUpdate(buildingId, req.log).catch(err => {
      req.log.error(err, 'Background embedding update failed')
    })
  })

  fastify.post('/embed', async (req, reply) => {
    const { building_id: buildingId } = req.body || {}
    if (!buildingId) {
      return reply.code(400).send({ error: 'building_id is required' })
    }

    try {
      return await updateBuildingEmbedding(buildingId, req.log)
    } catch (err) {
      req.log.error(err, 'Embedding update failed')
      return reply.code(500).send({ error: 'Embedding update failed' })
    }
  })
}

async function triggerEmbeddingUpdate(buildingId, log) {
  await new Promise(resolve => setTimeout(resolve, 2000))
  await updateBuildingEmbedding(buildingId, log)
}

async function updateBuildingEmbedding(buildingId, log = console) {
  const { data: building, error } = await supabase
    .from('buildings')
    .select('name, rooms(files(content))')
    .eq('id', buildingId)
    .single()

  if (error || !building) {
    throw new Error(`Building not found: ${buildingId}`)
  }

  const allText = [
    building.name,
    ...(building.rooms || []).flatMap(room => (room.files || []).map(file => file.content || '')),
  ].join(' ')

  if (!allText.trim()) return { connections: [] }

  const embedding = await getEmbedding(allText.slice(0, 8000))

  const { error: updateError } = await supabase
    .from('buildings')
    .update({ embedding: JSON.stringify(embedding) })
    .eq('id', buildingId)

  if (updateError) {
    throw new Error(`Failed to update embedding: ${updateError.message}`)
  }

  const { data: similar, error: rpcError } = await supabase.rpc('find_similar_buildings', {
    query_embedding: JSON.stringify(embedding),
    exclude_id: buildingId,
    threshold: 0.82,
    limit_count: 5,
  })

  if (rpcError) {
    log.error(rpcError, 'find_similar_buildings RPC failed')
    return { connections: [] }
  }

  for (const result of similar || []) {
    const { error: connectionError } = await supabase.from('connections').upsert({
      building_a: buildingId < result.id ? buildingId : result.id,
      building_b: buildingId < result.id ? result.id : buildingId,
      strength: result.similarity,
    }, { onConflict: 'building_a,building_b' })

    if (connectionError) {
      log.error(connectionError, `Failed to upsert connection for ${result.id}`)
    }
  }

  return { connections: similar || [] }
}
