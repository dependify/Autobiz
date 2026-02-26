import Anthropic from '@anthropic-ai/sdk'
import { AI_MODELS } from '@dependify/config'

let anthropicClient: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required')
    }
    anthropicClient = new Anthropic({ apiKey })
  }
  return anthropicClient
}

// Call Claude with automatic fallback
export async function callClaude(
  messages: Anthropic.MessageParam[],
  options: {
    model?: string
    systemPrompt?: string
    maxTokens?: number
    tools?: Anthropic.Tool[]
  } = {}
): Promise<Anthropic.Message> {
  const client = getAnthropicClient()

  const model = options.model ?? AI_MODELS.CLAUDE_SONNET
  const maxTokens = options.maxTokens ?? 4096

  try {
    return await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: options.systemPrompt,
      messages,
      tools: options.tools,
    })
  } catch (err) {
    // Fallback to Haiku on rate limit or model errors
    if (model === AI_MODELS.CLAUDE_SONNET) {
      console.warn('[AI Client] Sonnet failed, falling back to Haiku:', err)
      return await client.messages.create({
        model: AI_MODELS.CLAUDE_HAIKU,
        max_tokens: maxTokens,
        system: options.systemPrompt,
        messages,
        tools: options.tools,
      })
    }
    throw err
  }
}

// Simple text generation (no tool use)
export async function generateText(
  prompt: string,
  systemPrompt?: string,
  model?: string
): Promise<string> {
  const response = await callClaude(
    [{ role: 'user', content: prompt }],
    { model, systemPrompt, maxTokens: 2048 }
  )

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text content in response')
  }

  return textBlock.text
}

// Try Ollama (local model) first, fall back to Claude
export async function generateWithLocalFallback(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const ollamaUrl = process.env.OLLAMA_URL ?? 'http://localhost:11434'

  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: AI_MODELS.OLLAMA_LLAMA,
        prompt: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) throw new Error(`Ollama error: ${response.status}`)

    const data = await response.json() as { response: string }
    return data.response
  } catch {
    // Fall back to Claude Haiku
    return generateText(prompt, systemPrompt, AI_MODELS.CLAUDE_HAIKU)
  }
}
