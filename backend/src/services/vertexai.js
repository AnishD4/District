import { GoogleGenerativeAI } from '@google/generative-ai'
import { getEnv, requireEnv } from '../lib/env.js'

let genAI = null

function getGenAI() {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(requireEnv('GEMINI_API_KEY'))
  }
  return genAI
}

export function getGeminiPro() {
  return getGenAI().getGenerativeModel({
    model: getEnv('GEMINI_CHAT_MODEL', 'gemini-3.5-flash'),
    generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
  })
}

export function getGeminiFlash() {
  return getGenAI().getGenerativeModel({
    model: getEnv('GEMINI_FLASH_MODEL', 'gemini-3.1-flash-lite'),
    generationConfig: { maxOutputTokens: 512, temperature: 0.3 },
  })
}

export async function getEmbedding(text) {
  if (!text?.trim()) {
    throw new Error('Cannot generate an embedding for empty text')
  }

  const apiKey = requireEnv('GEMINI_API_KEY')
  const model = getEnv('GEMINI_EMBEDDING_MODEL', 'gemini-embedding-001')
  const dimensions = Number.parseInt(getEnv('GEMINI_EMBEDDING_DIMENSIONS', '768'), 10)

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      outputDimensionality: dimensions,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Gemini embedding API error (${response.status}): ${errorBody}`)
  }

  const result = await response.json()

  if (!result?.embedding?.values?.length) {
    throw new Error('Gemini embedding API returned an unexpected response')
  }

  return result.embedding.values
}
