import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// Chat model — long context for building conversations
export const geminiPro = genAI.getGenerativeModel({
  model: 'gemini-1.5-pro',
  generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
})

// Fast model — quick lookups and summaries
export const geminiFlash = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  generationConfig: { maxOutputTokens: 512, temperature: 0.3 },
})

// Embedding model — 768-dim vectors for pgvector
export const getEmbedding = async (text) => {
  const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' })
  const result = await embeddingModel.embedContent(text)
  return result.embedding.values
}

