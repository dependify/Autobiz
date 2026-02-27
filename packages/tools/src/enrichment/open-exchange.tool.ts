import type { DependifyTool } from '@dependify/orchestrator'

export const openExchangeTool: DependifyTool = {
  id: 'tool.currency.open_exchange',
  name: 'Get Exchange Rates via Open Exchange Rates',
  description:
    'Retrieve current foreign exchange rates for a base currency using the Open Exchange Rates API. Free tier supports USD as base currency.',
  category: 'enrichment',
  costProfile: 'free',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      base: {
        type: 'string',
        description: 'Base currency ISO code (e.g. USD). Free plan requires USD.',
        default: 'USD',
      },
      symbols: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Specific currencies to return (e.g. ["NGN","GBP","EUR"]). Returns all if omitted.',
      },
    },
    required: ['base'],
  },
  outputSchema: {
    properties: {
      rates: {
        type: 'object',
        description: 'Map of currency code to exchange rate relative to base',
        additionalProperties: { type: 'number' },
      },
      timestamp: { type: 'number', description: 'Unix timestamp of when rates were last updated' },
    },
  },
  async execute(input: unknown) {
    const { base, symbols } = input as { base: string; symbols?: string[] }

    const appId = process.env.OPEN_EXCHANGE_APP_ID
    if (!appId) throw new Error('OPEN_EXCHANGE_APP_ID not configured')

    const params = new URLSearchParams({
      app_id: appId,
      base,
    })

    if (symbols?.length) {
      params.append('symbols', symbols.join(','))
    }

    const response = await fetch(
      `https://openexchangerates.org/api/latest.json?${params.toString()}`,
    )

    if (!response.ok) {
      const err = (await response.json()) as { description?: string; message?: string }
      throw new Error(
        `Open Exchange Rates API error: ${err.description ?? err.message ?? response.status}`,
      )
    }

    const result = (await response.json()) as {
      timestamp: number
      base: string
      rates: Record<string, number>
    }

    return {
      rates: result.rates,
      timestamp: result.timestamp,
    }
  },
}

export const openExchangeTools = [openExchangeTool]
