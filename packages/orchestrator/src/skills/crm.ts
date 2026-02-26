import type { DependifySkill, TenantContext } from '../types'
import { generateText } from '../lib/ai-client'
import { AI_MODELS } from '@dependify/config'

export const leadScoreSkill: DependifySkill = {
  id: 'crm.contact.score',
  name: 'Score Lead',
  description: 'Calculate a lead score (0-100) for a contact based on their profile, interactions, and behavior signals.',
  category: 'crm',
  model: 'claude-haiku',
  systemPrompt: 'You are a CRM specialist. Score leads based on fit, engagement, and buying signals. Return a numeric score and reasoning.',
  inputSchema: {
    properties: {
      contact: {
        type: 'object',
        description: 'Contact profile data',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          company: { type: 'string' },
          jobTitle: { type: 'string' },
          source: { type: 'string' },
          interactionCount: { type: 'number' },
          lastContactedAt: { type: 'string' },
          stage: { type: 'string' },
        },
      },
      idealCustomerProfile: { type: 'object', description: 'Description of ideal customer' },
    },
    required: ['contact'],
  },
  async execute(input: unknown, _context: TenantContext) {
    const { contact, idealCustomerProfile } = input as {
      contact: Record<string, unknown>
      idealCustomerProfile?: Record<string, unknown>
    }

    const prompt = `Score this lead from 0-100.

Contact: ${JSON.stringify(contact, null, 2)}
${idealCustomerProfile ? `Ideal Customer Profile: ${JSON.stringify(idealCustomerProfile, null, 2)}` : ''}

Scoring criteria:
- Company fit (does company size/industry match ICP): 30 points
- Role fit (is the person a decision maker): 20 points
- Engagement (interactions, recency): 25 points
- Stage fit (how far along are they): 25 points

Return JSON: { "score": 75, "breakdown": { "companyFit": 25, "roleFit": 18, "engagement": 15, "stageFit": 17 }, "reasoning": "...", "nextBestAction": "..." }`

    const result = await generateText(prompt, leadScoreSkill.systemPrompt, AI_MODELS.CLAUDE_HAIKU)

    try {
      return JSON.parse(result)
    } catch {
      return { score: 50, reasoning: result, nextBestAction: 'Follow up with more information' }
    }
  },
}

export const followupSuggestSkill: DependifySkill = {
  id: 'crm.followup.suggest',
  name: 'Suggest Follow-up',
  description: 'Suggest the next best follow-up action for a contact based on their interaction history and current stage.',
  category: 'crm',
  model: 'claude-haiku',
  systemPrompt: 'You are a sales strategist. Suggest specific, timely follow-up actions that move deals forward.',
  inputSchema: {
    properties: {
      contact: { type: 'object' },
      recentInteractions: { type: 'array', items: { type: 'object' } },
      dealValue: { type: 'number' },
    },
    required: ['contact'],
  },
  async execute(input: unknown, _context: TenantContext) {
    const { contact, recentInteractions = [], dealValue } = input as {
      contact: Record<string, unknown>
      recentInteractions?: Record<string, unknown>[]
      dealValue?: number
    }

    const prompt = `Suggest the best follow-up action for this contact.

Contact: ${JSON.stringify(contact, null, 2)}
Recent interactions: ${JSON.stringify(recentInteractions.slice(-5), null, 2)}
${dealValue ? `Deal value: ${dealValue}` : ''}

Return JSON: {
  "action": "send_email | schedule_call | send_proposal | close | nurture",
  "priority": "high | medium | low",
  "message": "Specific message to send (if applicable)",
  "reasoning": "Why this action",
  "bestTime": "Suggested timing",
  "subject": "Email subject if applicable"
}`

    const result = await generateText(prompt, followupSuggestSkill.systemPrompt, AI_MODELS.CLAUDE_HAIKU)

    try {
      return JSON.parse(result)
    } catch {
      return { action: 'send_email', priority: 'medium', reasoning: result }
    }
  },
}

export const crmSkills = [leadScoreSkill, followupSuggestSkill]
