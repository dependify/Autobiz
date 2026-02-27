import type { DependifyTool } from '@dependify/orchestrator'

export const firecrawlTool: DependifyTool = {
  id: 'tool.scrape.firecrawl',
  name: 'Scrape Web Page via Firecrawl',
  description:
    'Scrape a web page using a self-hosted Firecrawl service. Extracts clean markdown content and metadata from any URL, handling JavaScript rendering.',
  category: 'content',
  costProfile: 'free',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      url: { type: 'string', description: 'URL of the web page to scrape' },
      options: {
        type: 'object',
        properties: {
          onlyMainContent: {
            type: 'boolean',
            description: 'Extract only the main content, excluding navigation/footers',
            default: true,
          },
          includeMarkdown: {
            type: 'boolean',
            description: 'Return content in Markdown format',
            default: true,
          },
        },
      },
    },
    required: ['url'],
  },
  outputSchema: {
    properties: {
      markdown: { type: 'string', description: 'Extracted page content in Markdown format' },
      metadata: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
  },
  async execute(input: unknown) {
    const { url, options } = input as {
      url: string
      options?: { onlyMainContent?: boolean; includeMarkdown?: boolean }
    }

    const serviceUrl = process.env.FIRECRAWL_URL
    if (!serviceUrl) throw new Error('FIRECRAWL_URL not configured')

    const response = await fetch(`${serviceUrl}/v0/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        pageOptions: {
          onlyMainContent: options?.onlyMainContent ?? true,
          includeMarkdown: options?.includeMarkdown ?? true,
        },
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Firecrawl API error: ${response.status} - ${err}`)
    }

    const result = (await response.json()) as {
      success: boolean
      data?: {
        markdown?: string
        content?: string
        metadata?: {
          title?: string
          description?: string
          ogTitle?: string
          ogDescription?: string
        }
      }
    }

    if (!result.success || !result.data) {
      throw new Error('Firecrawl returned no data')
    }

    const metadata = result.data.metadata ?? {}

    return {
      markdown: result.data.markdown ?? result.data.content ?? '',
      metadata: {
        title: metadata.title ?? metadata.ogTitle ?? '',
        description: metadata.description ?? metadata.ogDescription ?? '',
      },
    }
  },
}

export const firecrawlTools = [firecrawlTool]
