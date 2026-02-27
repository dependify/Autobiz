import type { DependifyTool } from '@dependify/orchestrator'

export const hunterTool: DependifyTool = {
  id: 'tool.enrichment.hunter',
  name: 'Email & Person Enrichment via Hunter.io',
  description:
    'Look up professional email addresses and person details using Hunter.io. Supports email verification by address or domain search to find contact information.',
  category: 'enrichment',
  costProfile: 'metered',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      email: { type: 'string', description: 'Email address to verify and enrich' },
      domain: {
        type: 'string',
        description: 'Domain to search for email addresses (used if email not provided)',
      },
    },
  },
  outputSchema: {
    properties: {
      email: { type: 'string' },
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      position: { type: 'string' },
      company: { type: 'string' },
      linkedinUrl: { type: 'string' },
      confidence: { type: 'number', description: 'Confidence score 0-100' },
    },
  },
  async execute(input: unknown) {
    const { email, domain } = input as { email?: string; domain?: string }

    const apiKey = process.env.HUNTER_API_KEY
    if (!apiKey) throw new Error('HUNTER_API_KEY not configured')

    if (!email && !domain) {
      throw new Error('Either email or domain must be provided')
    }

    if (email) {
      // Email verification + enrichment
      const url = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${apiKey}`
      const response = await fetch(url)

      if (!response.ok) {
        const err = (await response.json()) as { errors?: Array<{ details: string }> }
        throw new Error(`Hunter.io API error: ${err.errors?.[0]?.details ?? response.status}`)
      }

      const result = (await response.json()) as {
        data: {
          email: string
          score?: number
          status?: string
          first_name?: string
          last_name?: string
          position?: string
          company?: string
          linkedin?: string
        }
      }

      const data = result.data
      return {
        email: data.email,
        firstName: data.first_name ?? '',
        lastName: data.last_name ?? '',
        position: data.position ?? '',
        company: data.company ?? '',
        linkedinUrl: data.linkedin ?? '',
        confidence: data.score ?? 0,
      }
    } else {
      // Domain search — get first result
      const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain!)}&api_key=${apiKey}&limit=1`
      const response = await fetch(url)

      if (!response.ok) {
        const err = (await response.json()) as { errors?: Array<{ details: string }> }
        throw new Error(`Hunter.io API error: ${err.errors?.[0]?.details ?? response.status}`)
      }

      const result = (await response.json()) as {
        data: {
          domain: string
          organization?: string
          emails?: Array<{
            value: string
            first_name?: string
            last_name?: string
            position?: string
            confidence?: number
            linkedin?: string
          }>
        }
      }

      const contact = result.data.emails?.[0]

      return {
        email: contact?.value ?? '',
        firstName: contact?.first_name ?? '',
        lastName: contact?.last_name ?? '',
        position: contact?.position ?? '',
        company: result.data.organization ?? '',
        linkedinUrl: contact?.linkedin ?? '',
        confidence: contact?.confidence ?? 0,
      }
    }
  },
}

export const hunterTools = [hunterTool]
