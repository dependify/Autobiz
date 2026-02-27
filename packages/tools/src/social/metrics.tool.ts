import type { DependifyTool } from '@dependify/orchestrator'

export const instagramMetricsTool: DependifyTool = {
  id: 'tool.social.metrics.instagram',
  name: 'Get Instagram Account Metrics',
  description:
    'Retrieve Instagram account metrics including followers, engagement rate, reach, and post count via the Instagram Graph API.',
  category: 'social',
  costProfile: 'free',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      accountId: { type: 'string', description: 'Instagram Business account ID' },
      period: {
        type: 'string',
        description: 'Metrics period (e.g. day, week, month)',
        default: 'month',
      },
      metrics: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific metrics to retrieve',
      },
    },
    required: ['accountId'],
  },
  outputSchema: {
    properties: {
      followers: { type: 'number' },
      engagement: { type: 'number' },
      reach: { type: 'number' },
      posts: { type: 'number' },
      topPost: { type: 'object' },
    },
  },
  async execute(input: unknown) {
    const { accountId } = input as { accountId: string; period?: string; metrics?: string[] }

    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN
    if (!accessToken) throw new Error('INSTAGRAM_ACCESS_TOKEN not configured')

    const fields = 'followers_count,media_count,biography,website'
    const url = `https://graph.facebook.com/v19.0/${accountId}?fields=${fields}&access_token=${accessToken}`

    const response = await fetch(url)
    if (!response.ok) {
      const err = (await response.json()) as { error: { message: string } }
      throw new Error(`Instagram Graph API error: ${err.error?.message}`)
    }

    const data = (await response.json()) as {
      followers_count: number
      media_count: number
    }

    // Fetch recent media to calculate engagement
    const mediaUrl = `https://graph.facebook.com/v19.0/${accountId}/media?fields=id,like_count,comments_count,timestamp&limit=10&access_token=${accessToken}`
    const mediaResponse = await fetch(mediaUrl)
    let engagement = 0
    let topPost: Record<string, unknown> | undefined

    if (mediaResponse.ok) {
      const mediaData = (await mediaResponse.json()) as {
        data: Array<{ id: string; like_count?: number; comments_count?: number; timestamp: string }>
      }
      const posts = mediaData.data ?? []
      if (posts.length > 0) {
        const totalEngagement = posts.reduce(
          (acc, p) => acc + (p.like_count ?? 0) + (p.comments_count ?? 0),
          0,
        )
        engagement =
          data.followers_count > 0
            ? (totalEngagement / posts.length / data.followers_count) * 100
            : 0
        const topPostRaw = posts.reduce((best, p) =>
          (p.like_count ?? 0) + (p.comments_count ?? 0) >
          (best.like_count ?? 0) + (best.comments_count ?? 0)
            ? p
            : best,
        )
        topPost = topPostRaw as Record<string, unknown>
      }
    }

    return {
      followers: data.followers_count ?? 0,
      engagement: Math.round(engagement * 100) / 100,
      reach: 0, // Requires page insights permission
      posts: data.media_count ?? 0,
      topPost,
    }
  },
}

export const facebookMetricsTool: DependifyTool = {
  id: 'tool.social.metrics.facebook',
  name: 'Get Facebook Page Metrics',
  description:
    'Retrieve Facebook Page insights including fans, reach, impressions, and engagement metrics via the Facebook Graph API.',
  category: 'social',
  costProfile: 'free',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      accountId: { type: 'string', description: 'Facebook Page ID' },
      period: {
        type: 'string',
        description: 'Insights period: day, week, or month',
        default: 'month',
      },
      metrics: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific insight metrics to retrieve',
      },
    },
    required: ['accountId'],
  },
  outputSchema: {
    properties: {
      followers: { type: 'number' },
      engagement: { type: 'number' },
      reach: { type: 'number' },
      posts: { type: 'number' },
      topPost: { type: 'object' },
    },
  },
  async execute(input: unknown) {
    const { accountId, period } = input as {
      accountId: string
      period?: string
      metrics?: string[]
    }

    const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN
    if (!accessToken) throw new Error('FACEBOOK_PAGE_ACCESS_TOKEN not configured')

    const resolvedPeriod = period ?? 'month'

    // Get page fan count
    const pageUrl = `https://graph.facebook.com/v19.0/${accountId}?fields=fan_count,posts.limit(10){likes.summary(true),comments.summary(true)}&access_token=${accessToken}`
    const pageResponse = await fetch(pageUrl)

    if (!pageResponse.ok) {
      const err = (await pageResponse.json()) as { error: { message: string } }
      throw new Error(`Facebook Graph API error: ${err.error?.message}`)
    }

    const pageData = (await pageResponse.json()) as {
      fan_count: number
      posts?: {
        data: Array<{
          id: string
          likes?: { summary: { total_count: number } }
          comments?: { summary: { total_count: number } }
        }>
      }
    }

    // Get page insights
    const insightsUrl = `https://graph.facebook.com/v19.0/${accountId}/insights?metric=page_impressions,page_post_engagements&period=${resolvedPeriod}&access_token=${accessToken}`
    const insightsResponse = await fetch(insightsUrl)
    let reach = 0
    let engagement = 0

    if (insightsResponse.ok) {
      const insightsData = (await insightsResponse.json()) as {
        data: Array<{ name: string; values: Array<{ value: number }> }>
      }
      for (const metric of insightsData.data ?? []) {
        const latestValue = metric.values?.[metric.values.length - 1]?.value ?? 0
        if (metric.name === 'page_impressions') reach = latestValue
        if (metric.name === 'page_post_engagements') engagement = latestValue
      }
    }

    const posts = pageData.posts?.data ?? []
    let topPost: Record<string, unknown> | undefined
    if (posts.length > 0) {
      topPost = posts.reduce((best, p) => {
        const bestScore =
          (best.likes?.summary?.total_count ?? 0) + (best.comments?.summary?.total_count ?? 0)
        const pScore =
          (p.likes?.summary?.total_count ?? 0) + (p.comments?.summary?.total_count ?? 0)
        return pScore > bestScore ? p : best
      }) as Record<string, unknown>
    }

    return {
      followers: pageData.fan_count ?? 0,
      engagement,
      reach,
      posts: posts.length,
      topPost,
    }
  },
}

export const twitterMetricsTool: DependifyTool = {
  id: 'tool.social.metrics.twitter',
  name: 'Get Twitter/X Account Metrics',
  description:
    'Retrieve Twitter/X account public metrics including followers, following, tweet count, and listed count via the Twitter API v2.',
  category: 'social',
  costProfile: 'free',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      accountId: { type: 'string', description: 'Twitter user ID' },
      period: { type: 'string', description: 'Period for metrics (informational only)' },
      metrics: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific metrics to retrieve',
      },
    },
    required: ['accountId'],
  },
  outputSchema: {
    properties: {
      followers: { type: 'number' },
      engagement: { type: 'number' },
      reach: { type: 'number' },
      posts: { type: 'number' },
      topPost: { type: 'object' },
    },
  },
  async execute(input: unknown) {
    const { accountId } = input as { accountId: string; period?: string; metrics?: string[] }

    const bearerToken = process.env.TWITTER_BEARER_TOKEN
    if (!bearerToken) throw new Error('TWITTER_BEARER_TOKEN not configured')

    const url = `https://api.twitter.com/2/users/${accountId}?user.fields=public_metrics,description,verified`

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    })

    if (!response.ok) {
      const err = (await response.json()) as { detail?: string; title?: string }
      throw new Error(`Twitter API error: ${err.detail ?? err.title}`)
    }

    const result = (await response.json()) as {
      data: {
        public_metrics: {
          followers_count: number
          following_count: number
          tweet_count: number
          listed_count: number
        }
      }
    }

    const metrics = result.data?.public_metrics

    return {
      followers: metrics?.followers_count ?? 0,
      engagement: 0, // Requires tweet-level data
      reach: metrics?.followers_count ?? 0,
      posts: metrics?.tweet_count ?? 0,
      topPost: undefined,
    }
  },
}

export const linkedinMetricsTool: DependifyTool = {
  id: 'tool.social.metrics.linkedin',
  name: 'Get LinkedIn Organization Metrics',
  description:
    'Retrieve LinkedIn organization follower statistics and engagement metrics via the LinkedIn API.',
  category: 'social',
  costProfile: 'free',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      accountId: { type: 'string', description: 'LinkedIn organization URN or numeric ID' },
      period: { type: 'string', description: 'Statistics period (informational)' },
      metrics: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific metrics to retrieve',
      },
    },
    required: ['accountId'],
  },
  outputSchema: {
    properties: {
      followers: { type: 'number' },
      engagement: { type: 'number' },
      reach: { type: 'number' },
      posts: { type: 'number' },
      topPost: { type: 'object' },
    },
  },
  async execute(input: unknown) {
    const { accountId } = input as { accountId: string; period?: string; metrics?: string[] }

    const accessToken = process.env.LINKEDIN_ACCESS_TOKEN
    if (!accessToken) throw new Error('LINKEDIN_ACCESS_TOKEN not configured')

    const orgUrn = accountId.startsWith('urn:') ? accountId : `urn:li:organization:${accountId}`
    const encodedUrn = encodeURIComponent(orgUrn)

    const url = `https://api.linkedin.com/v2/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${encodedUrn}`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    })

    if (!response.ok) {
      const err = (await response.json()) as { message?: string; status?: number }
      throw new Error(`LinkedIn API error: ${err.message ?? response.status}`)
    }

    const result = (await response.json()) as {
      elements: Array<{
        followerCountsByAssociationType?: Array<{
          followerCounts: { organicFollowerCount: number }
        }>
      }>
    }

    const element = result.elements?.[0]
    const organicFollowers =
      element?.followerCountsByAssociationType?.reduce(
        (acc, entry) => acc + (entry.followerCounts?.organicFollowerCount ?? 0),
        0,
      ) ?? 0

    return {
      followers: organicFollowers,
      engagement: 0,
      reach: 0,
      posts: 0,
      topPost: undefined,
    }
  },
}

export const youtubeMetricsTool: DependifyTool = {
  id: 'tool.social.metrics.youtube',
  name: 'Get YouTube Channel Metrics',
  description:
    'Retrieve YouTube channel statistics including subscriber count, view count, and video count via the YouTube Data API v3.',
  category: 'social',
  costProfile: 'free',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      accountId: { type: 'string', description: 'YouTube channel ID' },
      period: { type: 'string', description: 'Period for metrics (informational)' },
      metrics: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific metrics to retrieve',
      },
    },
    required: ['accountId'],
  },
  outputSchema: {
    properties: {
      followers: { type: 'number' },
      engagement: { type: 'number' },
      reach: { type: 'number' },
      posts: { type: 'number' },
      topPost: { type: 'object' },
    },
  },
  async execute(input: unknown) {
    const { accountId } = input as { accountId: string; period?: string; metrics?: string[] }

    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) throw new Error('YOUTUBE_API_KEY not configured')

    const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${accountId}&key=${apiKey}`

    const response = await fetch(url)
    if (!response.ok) {
      const err = (await response.json()) as { error: { message: string } }
      throw new Error(`YouTube API error: ${err.error?.message}`)
    }

    const result = (await response.json()) as {
      items: Array<{
        statistics: {
          subscriberCount: string
          viewCount: string
          videoCount: string
          hiddenSubscriberCount: boolean
        }
      }>
    }

    const stats = result.items?.[0]?.statistics

    if (!stats) {
      throw new Error(`YouTube channel not found: ${accountId}`)
    }

    return {
      followers: parseInt(stats.subscriberCount ?? '0', 10),
      engagement: 0,
      reach: parseInt(stats.viewCount ?? '0', 10),
      posts: parseInt(stats.videoCount ?? '0', 10),
      topPost: undefined,
    }
  },
}

export const socialMetricsTools = [
  instagramMetricsTool,
  facebookMetricsTool,
  twitterMetricsTool,
  linkedinMetricsTool,
  youtubeMetricsTool,
]
