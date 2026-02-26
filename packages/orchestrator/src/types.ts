import type { MarketCode, ToolCategory } from '@dependify/config'

export interface TenantContext {
  tenantId: string
  userId: string
  market: MarketCode
  plan: string
  settings: Record<string, unknown>
}

export interface OrchestratorInput {
  message: string
  context: TenantContext
  conversationHistory?: ConversationMessage[]
  metadata?: Record<string, unknown>
}

export interface OrchestratorResult {
  response: string
  toolsUsed: string[]
  tokensUsed: number
  model: string
  executionTime: number
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface DependifyTool {
  id: string
  name: string
  description: string
  category: ToolCategory
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
  costProfile: 'free' | 'paid' | 'metered'
  marketSupport: MarketCode[]
  execute: (input: unknown, context: TenantContext) => Promise<unknown>
}

export interface DependifySkill {
  id: string
  name: string
  description: string
  category: ToolCategory
  model: 'claude-sonnet' | 'claude-haiku' | 'ollama-llama'
  systemPrompt: string
  inputSchema: Record<string, unknown>
  execute: (input: unknown, context: TenantContext) => Promise<unknown>
}

export interface ToolRegistry {
  register: (tool: DependifyTool) => void
  registerSkill: (skill: DependifySkill) => void
  getTool: (id: string) => DependifyTool | undefined
  getSkill: (id: string) => DependifySkill | undefined
  listTools: (category?: ToolCategory) => DependifyTool[]
  listSkills: (category?: ToolCategory) => DependifySkill[]
  getToolsForMarket: (market: MarketCode) => DependifyTool[]
}

export type IntentCategory =
  | 'crm'
  | 'content_creation'
  | 'social_media'
  | 'seo'
  | 'finance'
  | 'voice'
  | 'proposals'
  | 'analytics'
  | 'general'

export interface ClassifiedIntent {
  category: IntentCategory
  action: string
  entities: Record<string, string>
  confidence: number
  suggestedTools: string[]
}
