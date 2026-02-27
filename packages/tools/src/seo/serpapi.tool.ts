import type { DependifyTool } from '@dependify/orchestrator'

export const serpapiTool: DependifyTool = {
  id: 'tool.seo.serpapi',
  name: 'SERP Analysis via SerpAPI',
  description:
    'Retrieve real-time Google search engine results pages (SERP) data for a keyword including organic results, related searches, and People Also Ask boxes.',
  category: 'seo',
  costProfile: 'metered',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      keyword: { type: 'string', description: 'Search keyword or phrase to analyze' },
      location: {
        type: 'string',
        description: 'Geographic location for localized results (e.g. "New York, United States")',
      },
      device: {
        type: 'string',
        enum: ['desktop', 'mobile', 'tablet'],
        description: 'Device type for results',
        default: 'desktop',
      },
    },
    required: ['keyword'],
  },
  outputSchema: {
    properties: {
      organicResults: { type: 'array', items: { type: 'object' } },
      relatedSearches: { type: 'array', items: { type: 'object' } },
      peopleAlsoAsk: { type: 'array', items: { type: 'object' } },
    },
  },
  async execute(input: unknown) {
    const { keyword, location, device } = input as {
      keyword: string
      location?: string
      device?: string
    }

    const apiKey = process.env.SERPAPI_KEY
    if (!apiKey) throw new Error('SERPAPI_KEY not configured')

    const params = new URLSearchParams({
      q: keyword,
      api_key: apiKey,
      output: 'json',
      engine: 'google',
    })

    if (location) params.append('location', location)
    if (device) params.append('device', device)

    const response = await fetch(`https://serpapi.com/search?${params.toString()}`)

    if (!response.ok) {
      const err = (await response.json()) as { error?: string }
      throw new Error(`SerpAPI error: ${err.error ?? response.status}`)
    }

    const result = (await response.json()) as {
      organic_results?: object[]
      related_searches?: object[]
      people_also_ask?: object[]
    }

    return {
      organicResults: result.organic_results ?? [],
      relatedSearches: result.related_searches ?? [],
      peopleAlsoAsk: result.people_also_ask ?? [],
    }
  },
}

export const serpapiTools = [serpapiTool]
