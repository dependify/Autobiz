import type { DependifyTool } from '@dependify/orchestrator'

export const apolloTool: DependifyTool = {
  id: 'tool.enrichment.apollo_free',
  name: 'People & Company Enrichment via Apollo.io',
  description:
    'Enrich contact and company data using Apollo.io. Match by email, domain, or name to retrieve title, company, industry, employee count, and LinkedIn profile.',
  category: 'enrichment',
  costProfile: 'metered',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      email: { type: 'string', description: 'Email address to match against' },
      domain: { type: 'string', description: 'Company domain to match against' },
      firstName: { type: 'string', description: 'First name for matching' },
      lastName: { type: 'string', description: 'Last name for matching' },
    },
  },
  outputSchema: {
    properties: {
      name: { type: 'string' },
      title: { type: 'string' },
      company: { type: 'string' },
      industry: { type: 'string' },
      employeeCount: { type: 'number' },
      linkedinUrl: { type: 'string' },
    },
  },
  async execute(input: unknown) {
    const { email, domain, firstName, lastName } = input as {
      email?: string
      domain?: string
      firstName?: string
      lastName?: string
    }

    const apiKey = process.env.APOLLO_API_KEY
    if (!apiKey) throw new Error('APOLLO_API_KEY not configured')

    if (!email && !domain && !firstName && !lastName) {
      throw new Error('At least one of email, domain, firstName, or lastName must be provided')
    }

    const body: Record<string, unknown> = {}
    if (email) body.email = email
    if (domain) body.domain = domain
    if (firstName) body.first_name = firstName
    if (lastName) body.last_name = lastName

    const response = await fetch('https://api.apollo.io/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const err = (await response.json()) as { message?: string; error?: string }
      throw new Error(`Apollo.io API error: ${err.message ?? err.error ?? response.status}`)
    }

    const result = (await response.json()) as {
      person?: {
        name?: string
        first_name?: string
        last_name?: string
        title?: string
        linkedin_url?: string
        organization?: {
          name?: string
          industry?: string
          estimated_num_employees?: number
        }
      }
    }

    const person = result.person

    if (!person) {
      return {
        name: '',
        title: '',
        company: '',
        industry: '',
        employeeCount: 0,
        linkedinUrl: '',
      }
    }

    const fullName = person.name ?? [person.first_name, person.last_name].filter(Boolean).join(' ')

    return {
      name: fullName,
      title: person.title ?? '',
      company: person.organization?.name ?? '',
      industry: person.organization?.industry ?? '',
      employeeCount: person.organization?.estimated_num_employees ?? 0,
      linkedinUrl: person.linkedin_url ?? '',
    }
  },
}

export const apolloTools = [apolloTool]
