import { VertexAI } from '@google-cloud/vertexai'

const vertexAI = new VertexAI({
  project: process.env.GCP_PROJECT_ID,
  location: process.env.GCP_REGION || 'us-central1',
})

// Chat model — long context for building conversations
export const geminiPro = vertexAI.getGenerativeModel({
  model: 'gemini-1.5-pro',
  generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
})

// Fast model — quick lookups and summaries
export const geminiFlash = vertexAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  generationConfig: { maxOutputTokens: 512, temperature: 0.3 },
})

// Embedding model — 768-dim vectors for pgvector
export const getEmbedding = async (text) => {
  const embeddingModel = vertexAI.getGenerativeModel({ model: 'text-embedding-004' })
  const result = await embeddingModel.embedContent(text)
  return result.embedding.values
}
