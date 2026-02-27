import type { DependifyTool } from '@dependify/orchestrator'

export const pexelsTool: DependifyTool = {
  id: 'tool.image.pexels',
  name: 'Search Photos on Pexels',
  description:
    'Search for high-quality, royalty-free stock photos on Pexels. Returns photo URLs, thumbnails, and photographer attribution.',
  category: 'content',
  costProfile: 'free',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      query: { type: 'string', description: 'Search query for photos' },
      count: {
        type: 'number',
        description: 'Number of photos to return (default: 10, max: 80)',
        default: 10,
      },
      orientation: {
        type: 'string',
        enum: ['landscape', 'portrait', 'square'],
        description: 'Photo orientation filter',
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
            url: { type: 'string', description: 'Full-size photo URL' },
            thumbUrl: { type: 'string', description: 'Thumbnail URL' },
            photographer: { type: 'string', description: 'Photographer name' },
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

    const apiKey = process.env.PEXELS_API_KEY
    if (!apiKey) throw new Error('PEXELS_API_KEY not configured')

    const perPage = Math.min(count ?? 10, 80)
    const params = new URLSearchParams({
      query,
      per_page: String(perPage),
    })

    if (orientation) params.append('orientation', orientation)

    const response = await fetch(`https://api.pexels.com/v1/search?${params.toString()}`, {
      headers: { Authorization: apiKey },
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Pexels API error: ${response.status} - ${err}`)
    }

    const result = (await response.json()) as {
      photos: Array<{
        id: number
        src: {
          original: string
          medium: string
          small: string
        }
        photographer: string
        url: string
      }>
    }

    const images = result.photos.map((photo) => ({
      url: photo.src.medium,
      thumbUrl: photo.src.small,
      photographer: photo.photographer,
    }))

    return { images }
  },
}

export const pexelsTools = [pexelsTool]
