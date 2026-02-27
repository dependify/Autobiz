import type { DependifyTool } from '@dependify/orchestrator'

export const mozTool: DependifyTool = {
  id: 'tool.seo.moz_free',
  name: 'URL Metrics via Moz API',
  description:
    'Retrieve Domain Authority, Page Authority, spam score, and link count for a URL using the Moz URL Metrics API.',
  category: 'seo',
  costProfile: 'metered',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      url: { type: 'string', description: 'Target URL or domain to analyze' },
    },
    required: ['url'],
  },
  outputSchema: {
    properties: {
      domainAuthority: { type: 'number', description: 'Domain Authority score (0-100)' },
      pageAuthority: { type: 'number', description: 'Page Authority score (0-100)' },
      spamScore: { type: 'number', description: 'Spam score (0-17)' },
      linkCount: { type: 'number', description: 'Total number of inbound links' },
    },
  },
  async execute(input: unknown) {
    const { url } = input as { url: string }

    const accessId = process.env.MOZ_ACCESS_ID
    const secretKey = process.env.MOZ_SECRET_KEY

    if (!accessId) throw new Error('MOZ_ACCESS_ID not configured')
    if (!secretKey) throw new Error('MOZ_SECRET_KEY not configured')

    const credentials = Buffer.from(`${accessId}:${secretKey}`).toString('base64')

    const response = await fetch('https://lsapi.seomoz.com/v2/url_metrics', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targets: [url] }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Moz API error: ${response.status} - ${err}`)
    }

    const result = (await response.json()) as {
      results?: Array<{
        domain_authority?: number
        page_authority?: number
        spam_score?: number
        links_in?: number
      }>
    }

    const data = result.results?.[0]

    if (!data) {
      throw new Error(`Moz returned no data for URL: ${url}`)
    }

    return {
      domainAuthority: data.domain_authority ?? 0,
      pageAuthority: data.page_authority ?? 0,
      spamScore: data.spam_score ?? 0,
      linkCount: data.links_in ?? 0,
    }
  },
}

export const mozTools = [mozTool]
