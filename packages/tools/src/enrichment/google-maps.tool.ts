import type { DependifyTool } from '@dependify/orchestrator'

export const googleMapsTool: DependifyTool = {
  id: 'tool.maps.google',
  name: 'Search Places via Google Maps',
  description:
    'Search for local businesses and places using Google Places API. Returns name, address, phone number, rating, and website for each result.',
  category: 'enrichment',
  costProfile: 'metered',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      query: { type: 'string', description: 'Search query (e.g. "coffee shops in Lagos")' },
      location: { type: 'string', description: 'Location bias as "lat,lng" (optional)' },
      type: { type: 'string', description: 'Place type filter (e.g. restaurant, hospital, bank)' },
    },
    required: ['query'],
  },
  outputSchema: {
    properties: {
      places: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            address: { type: 'string' },
            phone: { type: 'string' },
            rating: { type: 'number' },
            website: { type: 'string' },
          },
        },
      },
    },
  },
  async execute(input: unknown) {
    const { query, location, type } = input as {
      query: string
      location?: string
      type?: string
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY not configured')

    // Step 1: Text search to get place IDs
    const searchParams = new URLSearchParams({
      query,
      key: apiKey,
    })

    if (location) searchParams.append('location', location)
    if (type) searchParams.append('type', type)

    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?${searchParams.toString()}`
    const searchResponse = await fetch(searchUrl)

    if (!searchResponse.ok) {
      const err = await searchResponse.text()
      throw new Error(`Google Maps API error: ${searchResponse.status} - ${err}`)
    }

    const searchResult = (await searchResponse.json()) as {
      status: string
      error_message?: string
      results: Array<{
        place_id: string
        name: string
        formatted_address: string
        rating?: number
        types?: string[]
      }>
    }

    if (searchResult.status !== 'OK' && searchResult.status !== 'ZERO_RESULTS') {
      throw new Error(
        `Google Maps API error: ${searchResult.status} - ${searchResult.error_message ?? ''}`,
      )
    }

    // Step 2: Enrich top results with place details (phone, website)
    const places = await Promise.all(
      (searchResult.results ?? []).slice(0, 10).map(async (place) => {
        try {
          const detailParams = new URLSearchParams({
            place_id: place.place_id,
            fields: 'name,formatted_address,formatted_phone_number,rating,website',
            key: apiKey,
          })

          const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?${detailParams.toString()}`
          const detailResponse = await fetch(detailUrl)

          if (!detailResponse.ok) {
            return {
              name: place.name,
              address: place.formatted_address,
              phone: '',
              rating: place.rating ?? 0,
              website: '',
            }
          }

          const detail = (await detailResponse.json()) as {
            result?: {
              name?: string
              formatted_address?: string
              formatted_phone_number?: string
              rating?: number
              website?: string
            }
          }

          const d = detail.result ?? {}

          return {
            name: d.name ?? place.name,
            address: d.formatted_address ?? place.formatted_address,
            phone: d.formatted_phone_number ?? '',
            rating: d.rating ?? place.rating ?? 0,
            website: d.website ?? '',
          }
        } catch {
          return {
            name: place.name,
            address: place.formatted_address,
            phone: '',
            rating: place.rating ?? 0,
            website: '',
          }
        }
      }),
    )

    return { places }
  },
}

export const googleMapsTools = [googleMapsTool]
