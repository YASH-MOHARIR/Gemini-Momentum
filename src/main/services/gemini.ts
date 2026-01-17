// ============ MAIN EXPORT FILE ============
// This file re-exports everything from the modular structure
// Other files can still import: import * as gemini from './services/gemini'

// Client & initialization
export { 
  initializeGemini, 
  isInitialized, 
  testConnection 
} from './gemini/client'

export type { 
  ExecutorProfile 
} from './gemini/client'

// Metrics
export { 
  getMetrics, 
  resetMetrics 
} from './gemini/metrics'

export type { 
  SessionMetrics 
} from './gemini/metrics'

// Router
export type { 
  TaskClassification 
} from './gemini/router'

// Orchestrator (main chat functions)
export { 
  chatStream, 
  chat 
} from './gemini/orchestrator'

export type { 
  ChatMessage, 
  ToolCallResult, 
  AgentResponse 
} from './gemini/orchestrator'

// Note: Tools, executor, and vision are internal modules
// They don't need to be exported as they're only used within the gemini package