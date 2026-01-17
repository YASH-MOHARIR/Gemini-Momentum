import { ExecutorProfile, PRICING, MODELS } from './client'

// ============ METRICS TRACKING ============

export interface SessionMetrics {
  tasksCompleted: number
  totalInputTokens: number
  totalOutputTokens: number
  modelUsage: Record<ExecutorProfile, number>
  escalations: number
  totalCost: number
  startTime: number
}

let sessionMetrics: SessionMetrics = {
  tasksCompleted: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  modelUsage: { 'flash-minimal': 0, 'flash-high': 0, 'pro-high': 0 },
  escalations: 0,
  totalCost: 0,
  startTime: Date.now()
}

export function getMetrics(): SessionMetrics & {
  sessionDuration: number
  estimatedSavings: number
} {
  const sessionDuration = Date.now() - sessionMetrics.startTime
  const proOnlyCost =
    (sessionMetrics.totalInputTokens / 1_000_000) * PRICING[MODELS.PRO].input +
    (sessionMetrics.totalOutputTokens / 1_000_000) * PRICING[MODELS.PRO].output
  const estimatedSavings = Math.max(0, proOnlyCost - sessionMetrics.totalCost)

  return {
    ...sessionMetrics,
    sessionDuration,
    estimatedSavings
  }
}

export function resetMetrics(): void {
  sessionMetrics = {
    tasksCompleted: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    modelUsage: { 'flash-minimal': 0, 'flash-high': 0, 'pro-high': 0 },
    escalations: 0,
    totalCost: 0,
    startTime: Date.now()
  }
}

export function updateMetrics(profile: ExecutorProfile, inputTokens: number, outputTokens: number): void {
  const pricing = PRICING[profile === 'pro-high' ? MODELS.PRO : MODELS.FLASH]

  sessionMetrics.totalInputTokens += inputTokens
  sessionMetrics.totalOutputTokens += outputTokens
  sessionMetrics.modelUsage[profile]++
  sessionMetrics.totalCost +=
    (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output
}

export function incrementTasksCompleted(): void {
  sessionMetrics.tasksCompleted++
}

export function incrementEscalations(): void {
  sessionMetrics.escalations++
}