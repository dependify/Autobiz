import type { DependifyTool } from '@dependify/orchestrator'

export const pdfGenerationTool: DependifyTool = {
  id: 'tool.pdf.generation',
  name: 'Generate PDF from HTML',
  description:
    'Generate a PDF document from HTML content using the Playwright service. Ideal for invoices, reports, proposals, and other printable documents.',
  category: 'content',
  costProfile: 'free',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      html: { type: 'string', description: 'Full HTML content to render as PDF' },
      options: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            enum: ['A4', 'A3', 'Letter', 'Legal', 'Tabloid'],
            description: 'Page format (default: A4)',
            default: 'A4',
          },
          landscape: {
            type: 'boolean',
            description: 'Use landscape orientation (default: false)',
            default: false,
          },
        },
      },
    },
    required: ['html'],
  },
  outputSchema: {
    properties: {
      pdfBuffer: { type: 'string', description: 'Base64-encoded PDF content' },
      url: { type: 'string', description: 'Accessible URL to download the generated PDF' },
    },
  },
  async execute(input: unknown) {
    const { html, options } = input as {
      html: string
      options?: { format?: string; landscape?: boolean }
    }

    const serviceUrl = process.env.PLAYWRIGHT_SERVICE_URL
    if (!serviceUrl) throw new Error('PLAYWRIGHT_SERVICE_URL not configured')

    const response = await fetch(`${serviceUrl}/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html,
        format: options?.format ?? 'A4',
        landscape: options?.landscape ?? false,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`PDF generation service error: ${response.status} - ${err}`)
    }

    const result = (await response.json()) as {
      base64?: string
      pdf?: string
      filename?: string
      url?: string
    }

    const base64Content = result.base64 ?? result.pdf ?? ''
    const filename = result.filename ?? `document-${Date.now()}.pdf`
    const fileUrl = result.url ?? `${serviceUrl}/files/${filename}`

    return {
      pdfBuffer: base64Content,
      url: fileUrl,
    }
  },
}

export const pdfTools = [pdfGenerationTool]
