import type { DependifyTool } from '@dependify/orchestrator'
import crypto from 'crypto'

/**
 * Creates a signed JWT for Google service account authentication.
 * Uses RS256 signing via Node.js crypto module.
 */
async function getGoogleAccessToken(scope: string): Promise<string> {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!serviceAccountJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured')

  let serviceAccount: {
    client_email: string
    private_key: string
    token_uri?: string
  }

  try {
    const decoded = Buffer.from(serviceAccountJson, 'base64').toString('utf-8')
    serviceAccount = JSON.parse(decoded)
  } catch {
    try {
      serviceAccount = JSON.parse(serviceAccountJson)
    } catch {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON must be valid JSON or base64-encoded JSON')
    }
  }

  const { client_email, private_key, token_uri } = serviceAccount

  if (!client_email || !private_key) {
    throw new Error('Service account JSON must contain client_email and private_key')
  }

  const tokenUri = token_uri ?? 'https://oauth2.googleapis.com/token'
  const now = Math.floor(Date.now() / 1000)

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({
      iss: client_email,
      scope,
      aud: tokenUri,
      exp: now + 3600,
      iat: now,
    }),
  ).toString('base64url')

  const signingInput = `${header}.${payload}`

  // Sign with RS256 using Node.js crypto
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(signingInput)
  sign.end()

  const rawPem = private_key.replace(/\\n/g, '\n')
  const signature = sign.sign(rawPem, 'base64url')

  const jwt = `${signingInput}.${signature}`

  const tokenResponse = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!tokenResponse.ok) {
    const err = await tokenResponse.text()
    throw new Error(`Google OAuth token error: ${err}`)
  }

  const tokenData = (await tokenResponse.json()) as { access_token: string }
  return tokenData.access_token
}

export const googleSearchConsoleTool: DependifyTool = {
  id: 'tool.seo.google_search_console',
  name: 'Query Google Search Console',
  description:
    'Retrieve search analytics data from Google Search Console including clicks, impressions, CTR, and average position for a website.',
  category: 'seo',
  costProfile: 'free',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      siteUrl: {
        type: 'string',
        description: 'The website URL as registered in Search Console (e.g. https://example.com/)',
      },
      startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
      endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' },
      dimensions: {
        type: 'array',
        items: { type: 'string', enum: ['query', 'page', 'country', 'device', 'date'] },
        description: 'Dimensions to group results by',
        default: ['query'],
      },
    },
    required: ['siteUrl', 'startDate', 'endDate'],
  },
  outputSchema: {
    properties: {
      rows: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            keys: { type: 'array', items: { type: 'string' } },
            clicks: { type: 'number' },
            impressions: { type: 'number' },
            ctr: { type: 'number' },
            position: { type: 'number' },
          },
        },
      },
    },
  },
  async execute(input: unknown) {
    const { siteUrl, startDate, endDate, dimensions } = input as {
      siteUrl: string
      startDate: string
      endDate: string
      dimensions?: string[]
    }

    const accessToken = await getGoogleAccessToken(
      'https://www.googleapis.com/auth/webmasters.readonly',
    )

    const encodedSiteUrl = encodeURIComponent(siteUrl)
    const apiUrl = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: dimensions ?? ['query'],
        rowLimit: 100,
      }),
    })

    if (!response.ok) {
      const err = (await response.json()) as { error: { message: string } }
      throw new Error(`Google Search Console API error: ${err.error?.message}`)
    }

    const result = (await response.json()) as {
      rows?: Array<{
        keys: string[]
        clicks: number
        impressions: number
        ctr: number
        position: number
      }>
    }

    return { rows: result.rows ?? [] }
  },
}

export const gscTools = [googleSearchConsoleTool]
