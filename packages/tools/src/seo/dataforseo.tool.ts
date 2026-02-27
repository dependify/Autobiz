import type { DependifyTool } from '@dependify/orchestrator'

export const dataforSeoTool: DependifyTool = {
  id: 'tool.seo.dataforseo',
  name: 'Keyword Research via DataForSEO',
  description:
    'Retrieve keyword search volume, difficulty, CPC, and competition data from DataForSEO Google Ads API. Includes related keyword suggestions.',
  category: 'seo',
  costProfile: 'metered',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      keyword: { type: 'string', description: 'Target keyword to analyze' },
      locationCode: {
        type: 'number',
        description: 'DataForSEO location code (default: 2840 for United States)',
      },
      languageCode: { type: 'string', description: 'Language code (default: en)', default: 'en' },
    },
    required: ['keyword'],
  },
  outputSchema: {
    properties: {
      volume: { type: 'number', description: 'Monthly search volume' },
      difficulty: { type: 'number', description: 'Keyword difficulty score (0-100)' },
      cpc: { type: 'number', description: 'Average cost per click in USD' },
      competition: { type: 'number', description: 'Competition level (0-1)' },
      relatedKeywords: { type: 'array', items: { type: 'object' } },
    },
  },
  async execute(input: unknown) {
    const { keyword, locationCode, languageCode } = input as {
      keyword: string
      locationCode?: number
      languageCode?: string
    }

    const email = process.env.DATAFORSEO_EMAIL
    const password = process.env.DATAFORSEO_PASSWORD

    if (!email) throw new Error('DATAFORSEO_EMAIL not configured')
    if (!password) throw new Error('DATAFORSEO_PASSWORD not configured')

    const credentials = Buffer.from(`${email}:${password}`).toString('base64')

    const response = await fetch(
      'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          {
            keywords: [keyword],
            location_code: locationCode ?? 2840,
            language_code: languageCode ?? 'en',
          },
        ]),
      },
    )

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`DataForSEO API error: ${response.status} - ${err}`)
    }

    const result = (await response.json()) as {
      status_code: number
      status_message: string
      tasks?: Array<{
        status_code: number
        status_message: string
        result?: Array<{
          keyword: string
          search_volume?: number
          keyword_difficulty?: number
          cpc?: number
          competition?: number
          monthly_searches?: Array<{ month: number; year: number; search_volume: number }>
        }>
      }>
    }

    if (result.status_code !== 20000) {
      throw new Error(`DataForSEO error: ${result.status_message}`)
    }

    const task = result.tasks?.[0]
    if (!task || task.status_code !== 20000) {
      throw new Error(`DataForSEO task error: ${task?.status_message}`)
    }

    const keywordData = task.result?.[0]

    return {
      volume: keywordData?.search_volume ?? 0,
      difficulty: keywordData?.keyword_difficulty ?? 0,
      cpc: keywordData?.cpc ?? 0,
      competition: keywordData?.competition ?? 0,
      relatedKeywords: keywordData?.monthly_searches ?? [],
    }
  },
}

export const dataforseoTools = [dataforSeoTool]
