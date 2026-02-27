import type { DependifyTool } from '@dependify/orchestrator'

export const unsplashTool: DependifyTool = {
  id: 'tool.image.unsplash',
  name: 'Search Photos on Unsplash',
  description:
    'Search for high-quality, royalty-free stock photos on Unsplash. Returns photo URLs, thumbnail URLs, and photographer attribution.',
  category: 'content',
  costProfile: 'free',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      query: { type: 'string', description: 'Search query for photos' },
      count: {
        type: 'number',
        description: 'Number of photos to return (default: 10, max: 30)',
        default: 10,
      },
      orientation: {
        type: 'string',
        enum: ['landscape', 'portrait', 'squarish'],
        description: 'Photo orientation filter',
        default: 'landscape',
      },
    },
    required: ['query'],
  },
  outputSchema: {
    properties: {
      images: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Full-size image URL' },
            thumbUrl: { type: 'string', description: 'Thumbnail URL' },
            photographer: { type: 'string', description: 'Photographer name' },
            downloadUrl: {
              type: 'string',
              description: 'Download trigger URL (required by Unsplash guidelines)',
            },
          },
        },
      },
    },
  },
  async execute(input: unknown) {
    const { query, count, orientation } = input as {
      query: string
      count?: number
      orientation?: string
    }

    const accessKey = process.env.UNSPLASH_ACCESS_KEY
    if (!accessKey) throw new Error('UNSPLASH_ACCESS_KEY not configured')

    const perPage = Math.min(count ?? 10, 30)
    const params = new URLSearchParams({
      query,
      per_page: String(perPage),
      orientation: orientation ?? 'landscape',
    })

    const response = await fetch(`https://api.unsplash.com/search/photos?${params.toString()}`, {
      headers: { Authorization: `Client-ID ${accessKey}` },
    })

    if (!response.ok) {
      const err = (await response.json()) as { errors?: string[] }
      throw new Error(`Unsplash API error: ${err.errors?.join(', ') ?? response.status}`)
    }

    const result = (await response.json()) as {
      results: Array<{
        id: string
        urls: { full: string; thumb: string; regular: string }
        user: { name: string }
        links: { download_location: string }
      }>
    }

    const images = result.results.map((photo) => ({
      url: photo.urls.regular,
      thumbUrl: photo.urls.thumb,
      photographer: photo.user.name,
      downloadUrl: photo.links.download_location,
    }))

    return { images }
  },
}

export const unsplashTools = [unsplashTool]
