import type { DependifyTool } from '@dependify/orchestrator'
import crypto from 'crypto'

/**
 * Creates a signed JWT for Google service account authentication.
 * Shared utility — duplicated here to keep each tool file self-contained.
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

export const googleAnalyticsTool: DependifyTool = {
  id: 'tool.seo.google_analytics',
  name: 'Run Google Analytics GA4 Report',
  description:
    'Run a custom report against a Google Analytics 4 property to retrieve metrics like sessions, users, bounce rate, and conversions over a date range.',
  category: 'seo',
  costProfile: 'free',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      propertyId: { type: 'string', description: 'GA4 property ID (numeric, e.g. 123456789)' },
      startDate: {
        type: 'string',
        description: 'Start date in YYYY-MM-DD format or relative (e.g. 7daysAgo)',
      },
      endDate: {
        type: 'string',
        description: 'End date in YYYY-MM-DD format or relative (e.g. today)',
      },
      metrics: {
        type: 'array',
        items: { type: 'string' },
        description: 'GA4 metric names (e.g. sessions, activeUsers, bounceRate)',
      },
      dimensions: {
        type: 'array',
        items: { type: 'string' },
        description: 'GA4 dimension names (e.g. date, country, deviceCategory)',
      },
    },
    required: ['propertyId', 'startDate', 'endDate', 'metrics'],
  },
  outputSchema: {
    properties: {
      rows: {
        type: 'array',
        items: { type: 'object' },
      },
      totals: { type: 'object' },
    },
  },
  async execute(input: unknown) {
    const { propertyId, startDate, endDate, metrics, dimensions } = input as {
      propertyId: string
      startDate: string
      endDate: string
      metrics: string[]
      dimensions?: string[]
    }

    const accessToken = await getGoogleAccessToken(
      'https://www.googleapis.com/auth/analytics.readonly',
    )

    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`

    const requestBody: Record<string, unknown> = {
      dateRanges: [{ startDate, endDate }],
      metrics: metrics.map((name) => ({ name })),
    }

    if (dimensions?.length) {
      requestBody.dimensions = dimensions.map((name) => ({ name }))
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const err = (await response.json()) as { error: { message: string } }
      throw new Error(`Google Analytics API error: ${err.error?.message}`)
    }

    const result = (await response.json()) as {
      rows?: Array<{
        dimensionValues?: Array<{ value: string }>
        metricValues?: Array<{ value: string }>
      }>
      totals?: Array<{ metricValues: Array<{ value: string }> }>
      dimensionHeaders?: Array<{ name: string }>
      metricHeaders?: Array<{ name: string }>
    }

    const dimensionHeaders = result.dimensionHeaders?.map((h) => h.name) ?? []
    const metricHeaders = result.metricHeaders?.map((h) => h.name) ?? []

    const rows = (result.rows ?? []).map((row) => {
      const record: Record<string, unknown> = {}
      dimensionHeaders.forEach((name, i) => {
        record[name] = row.dimensionValues?.[i]?.value ?? null
      })
      metricHeaders.forEach((name, i) => {
        record[name] = row.metricValues?.[i]?.value ?? null
      })
      return record
    })

    const totals: Record<string, unknown> = {}
    if (result.totals?.[0]) {
      metricHeaders.forEach((name, i) => {
        totals[name] = result.totals![0].metricValues[i]?.value ?? null
      })
    }

    return { rows, totals }
  },
}

export const ga4Tools = [googleAnalyticsTool]
