import type { DependifyTool } from '@dependify/orchestrator'

export const exchangeRateTool: DependifyTool = {
  id: 'tool.currency.exchangerate_api',
  name: 'Convert Currency via ExchangeRate-API',
  description:
    'Convert an amount between two currencies and get the current exchange rate using the ExchangeRate-API. Supports real-time conversion between 160+ currencies.',
  category: 'enrichment',
  costProfile: 'free',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      from: { type: 'string', description: 'Source currency ISO code (e.g. USD)' },
      to: { type: 'string', description: 'Target currency ISO code (e.g. NGN)' },
      amount: { type: 'number', description: 'Amount to convert' },
    },
    required: ['from', 'to', 'amount'],
  },
  outputSchema: {
    properties: {
      result: { type: 'number', description: 'Converted amount in the target currency' },
      rate: { type: 'number', description: 'Exchange rate from source to target currency' },
    },
  },
  async execute(input: unknown) {
    const { from, to, amount } = input as { from: string; to: string; amount: number }

    const apiKey = process.env.EXCHANGERATE_API_KEY
    if (!apiKey) throw new Error('EXCHANGERATE_API_KEY not configured')

    const url = `https://v6.exchangerate-api.com/v6/${apiKey}/pair/${from.toUpperCase()}/${to.toUpperCase()}/${amount}`

    const response = await fetch(url)

    if (!response.ok) {
      const err = await response.json() as { error-type?: string }
      throw new Error(`ExchangeRate-API error: ${(err as Record<string, string>)['error-type'] ?? response.status}`)
    }

    const result = await response.json() as {
      result: string
      conversion_rate: number
      conversion_result: number
    }

    if (result.result !== 'success') {
      throw new Error(`ExchangeRate-API failed: ${result.result}`)
    }

    return {
      result: result.conversion_result,
      rate: result.conversion_rate,
    }
  },
}

export const exchangeRateTools = [exchangeRateTool]
