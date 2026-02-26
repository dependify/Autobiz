import type { OrchestratorInput, OrchestratorResult, TenantContext } from './types'
import { classifyIntent } from './lib/intent-classifier'
import { toolRegistry } from './lib/tool-registry'
import { callClaude } from './lib/ai-client'
import { AI_MODELS } from '@dependify/config'
import type Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT = `You are Dependify AI, an intelligent business assistant for small and medium enterprises.

You have access to a comprehensive set of tools that help businesses:
- Manage contacts, leads, and deals (CRM)
- Create and publish content (blogs, social media, emails)
- Track SEO performance and keywords
- Send invoices and track payments
- Run voice call campaigns
- Generate professional proposals
- Analyze business metrics and generate reports

Your role is to:
1. Understand what the business owner needs
2. Select and use the right tools to accomplish their goal
3. Provide clear, actionable results
4. Always think in terms of business outcomes, not just task completion

Be proactive: if you see an opportunity to add value beyond what was asked, mention it (but don't do it without permission).
Be concise: business owners are busy. Get to the point.
Be specific: use actual data from the tools, not generic advice.`

export class DependifyOrchestrator {
  async process(input: OrchestratorInput): Promise<OrchestratorResult> {
    const startTime = Date.now()

    // 1. Classify intent
    const intent = await classifyIntent(input.message)

    // 2. Get relevant tools for this tenant's market
    const availableTools = toolRegistry.getToolsForMarket(input.context.market)

    // 3. Convert to Claude tool format
    const claudeTools = toolRegistry.toClaudeTools()

    // 4. Build conversation messages
    const messages: Anthropic.MessageParam[] = [
      ...(input.conversationHistory ?? []).map((h) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      {
        role: 'user' as const,
        content: input.message,
      },
    ]

    // 5. Run Claude with tool use
    const toolsUsed: string[] = []
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let finalResponse = ''

    let response = await callClaude(messages, {
      model: AI_MODELS.CLAUDE_SONNET,
      systemPrompt: SYSTEM_PROMPT,
      tools: claudeTools.length > 0 ? claudeTools as Anthropic.Tool[] : undefined,
      maxTokens: 4096,
    })

    totalInputTokens += response.usage.input_tokens
    totalOutputTokens += response.usage.output_tokens

    // 6. Agentic loop — handle tool calls
    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')

      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const toolUse of toolUseBlocks) {
        const toolId = toolUse.name.replace(/__/g, '.')
        toolsUsed.push(toolId)

        // Try tool first, then skill
        const tool = toolRegistry.getTool(toolId)
        const skill = toolRegistry.getSkill(toolId)

        let result: unknown
        try {
          if (tool) {
            result = await tool.execute(toolUse.input, input.context)
          } else if (skill) {
            result = await skill.execute(toolUse.input, input.context)
          } else {
            result = { error: `Tool ${toolId} not found in registry` }
          }
        } catch (err) {
          result = { error: String(err) }
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        })
      }

      // Continue conversation with tool results
      messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: toolResults })

      response = await callClaude(messages, {
        model: AI_MODELS.CLAUDE_SONNET,
        systemPrompt: SYSTEM_PROMPT,
        tools: claudeTools.length > 0 ? claudeTools as Anthropic.Tool[] : undefined,
        maxTokens: 4096,
      })

      totalInputTokens += response.usage.input_tokens
      totalOutputTokens += response.usage.output_tokens
    }

    // 7. Extract final text response
    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
    finalResponse = textBlock?.text ?? 'I completed the task but had no additional commentary.'

    return {
      response: finalResponse,
      toolsUsed,
      tokensUsed: totalInputTokens + totalOutputTokens,
      model: AI_MODELS.CLAUDE_SONNET,
      executionTime: Date.now() - startTime,
    }
  }
}

// Singleton orchestrator instance
export const orchestrator = new DependifyOrchestrator()
