import type { DependifyTool } from '@dependify/orchestrator'

export const playwrightTool: DependifyTool = {
  id: 'tool.scrape.playwright',
  name: 'Scrape Web Page via Playwright Service',
  description:
    'Scrape web pages using a self-hosted Playwright browser service. Handles JavaScript-heavy pages, supports CSS selectors, wait conditions, and screenshots.',
  category: 'content',
  costProfile: 'free',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      url: { type: 'string', description: 'URL to navigate to and scrape' },
      selector: { type: 'string', description: 'CSS selector to extract specific element(s)' },
      waitFor: {
        type: 'string',
        description: 'CSS selector or timeout to wait for before extracting content',
      },
      screenshot: {
        type: 'boolean',
        description: 'Whether to capture a screenshot of the page',
        default: false,
      },
    },
    required: ['url'],
  },
  outputSchema: {
    properties: {
      html: { type: 'string', description: 'Extracted HTML content' },
      text: { type: 'string', description: 'Extracted plain text content' },
      screenshotUrl: {
        type: 'string',
        description: 'URL of the captured screenshot (if requested)',
      },
    },
  },
  async execute(input: unknown) {
    const { url, selector, waitFor, screenshot } = input as {
      url: string
      selector?: string
      waitFor?: string
      screenshot?: boolean
    }

    const serviceUrl = process.env.PLAYWRIGHT_SERVICE_URL
    if (!serviceUrl) throw new Error('PLAYWRIGHT_SERVICE_URL not configured')

    const body: Record<string, unknown> = { url }
    if (selector) body.selector = selector
    if (waitFor) body.waitFor = waitFor
    if (screenshot !== undefined) body.screenshot = screenshot

    const response = await fetch(`${serviceUrl}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Playwright service error: ${response.status} - ${err}`)
    }

    const result = (await response.json()) as {
      html?: string
      text?: string
      screenshot?: string
      screenshotUrl?: string
    }

    return {
      html: result.html,
      text: result.text,
      screenshotUrl:
        result.screenshotUrl ??
        (result.screenshot ? `${serviceUrl}/screenshots/${result.screenshot}` : undefined),
    }
  },
}

export const playwrightTools = [playwrightTool]
