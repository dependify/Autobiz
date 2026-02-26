import type { ClassifiedIntent, IntentCategory } from '../types'
import { generateText } from './ai-client'
import { AI_MODELS } from '@dependify/config'

const INTENT_CLASSIFIER_PROMPT = `You are an intent classifier for Dependify, a business operating system.
Classify the user's message into a structured intent object.

Available intent categories:
- crm: Contact management, leads, deals, pipeline
- content_creation: Blog posts, social captions, emails, content repurposing
- social_media: Social account management, posting, analytics
- seo: Keyword research, rankings, content optimization
- finance: Invoices, payments, transactions, accounting
- voice: Phone calls, voice agents, call campaigns
- proposals: Proposals, quotes, contracts
- analytics: Reports, insights, dashboard data
- general: General business questions, help, other

Respond with JSON only:
{
  "category": "<category>",
  "action": "<specific action like 'create_contact', 'generate_blog_post', etc>",
  "entities": { "<entity_name>": "<entity_value>" },
  "confidence": <0-1 float>,
  "suggestedTools": ["<tool_id_1>", "<tool_id_2>"]
}`

export async function classifyIntent(message: string): Promise<ClassifiedIntent> {
  try {
    const result = await generateText(message, INTENT_CLASSIFIER_PROMPT, AI_MODELS.CLAUDE_HAIKU)
    const parsed = JSON.parse(result) as ClassifiedIntent
    return parsed
  } catch {
    // Default to general if classification fails
    return {
      category: 'general',
      action: 'unknown',
      entities: {},
      confidence: 0,
      suggestedTools: [],
    }
  }
}
