import { GoogleGenerativeAI } from '@google/generative-ai'

// ============ MODEL CONFIGURATION ============

export const MODELS = {
  FLASH: 'gemini-3.0-flash-preview',
  PRO: 'gemini-3.0-pro'
} as const

export type ExecutorProfile = 'flash-minimal' | 'flash-high' | 'pro-high'

export interface ExecutorConfig {
  model: string
  thinkingLevel: 'minimal' | 'low' | 'medium' | 'high'
  description: string
}

export const EXECUTOR_CONFIGS: Record<ExecutorProfile, ExecutorConfig> = {
  'flash-minimal': {
    model: MODELS.FLASH,
    thinkingLevel: 'minimal',
    description: 'Fast, simple operations'
  },
  'flash-high': {
    model: MODELS.FLASH,
    thinkingLevel: 'high',
    description: 'Complex file operations, vision, batch processing'
  },
  'pro-high': {
    model: MODELS.PRO,
    thinkingLevel: 'high',
    description: 'Complex reasoning, ambiguous requests, multi-step planning'
  }
}

// Pricing per 1M tokens
export const PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash': { input: 0.5, output: 3.0 },
  'gemini-2.5-pro': { input: 2.0, output: 12.0 }
}

// ============ CLIENT ============

let client: GoogleGenerativeAI | null = null

export function initializeGemini(apiKey: string): void {
  client = new GoogleGenerativeAI(apiKey)
}

export function getClient(): GoogleGenerativeAI {
  if (!client) {
    throw new Error('Gemini not initialized')
  }
  return client
}

export function isInitialized(): boolean {
  return client !== null
}

// ============ TEST CONNECTION ============

export async function testConnection(): Promise<{ success: boolean; error?: string }> {
  if (!client) {
    return { success: false, error: 'Not initialized' }
  }

  try {
    const model = client.getGenerativeModel({ model: MODELS.FLASH })
    const result = await model.generateContent('Reply with only: OK')
    console.log('[TEST]', result.response.text())
    return { success: true }
  } catch (error) {
    console.error('[TEST] Error:', error)
    return { success: false, error: String(error) }
  }
}
