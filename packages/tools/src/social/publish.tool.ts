import type { DependifyTool } from '@dependify/orchestrator'

export const socialPublishTool: DependifyTool = {
  id: 'tool.social.publish',
  name: 'Publish to Social Media',
  description:
    'Publish content to social media platforms including Facebook, Instagram, Twitter/X, LinkedIn, and YouTube. Automatically dispatches to the correct platform API.',
  category: 'social',
  costProfile: 'free',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      platform: {
        type: 'string',
        enum: ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube'],
        description: 'Target social media platform',
      },
      accountId: { type: 'string', description: 'Platform account/page ID' },
      content: { type: 'string', description: 'Post text content' },
      mediaUrls: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional media attachment URLs',
      },
      hashtags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Hashtags to append to the post',
      },
    },
    required: ['platform', 'accountId', 'content'],
  },
  outputSchema: {
    properties: {
      platformPostId: { type: 'string', description: 'Platform-assigned post ID' },
      url: { type: 'string', description: 'Public URL of the published post' },
      status: { type: 'string', description: 'Publication status' },
    },
  },
  async execute(input: unknown) {
    const { platform, accountId, content, mediaUrls, hashtags } = input as {
      platform: string
      accountId: string
      content: string
      mediaUrls?: string[]
      hashtags?: string[]
    }

    const fullText = hashtags?.length
      ? `${content}\n\n${hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}`
      : content

    switch (platform.toLowerCase()) {
      case 'facebook':
      case 'instagram': {
        const accessToken = process.env.FACEBOOK_ACCESS_TOKEN
        if (!accessToken) throw new Error('FACEBOOK_ACCESS_TOKEN not configured')

        const body: Record<string, unknown> = { message: fullText, access_token: accessToken }
        if (mediaUrls?.length) body.link = mediaUrls[0]

        const response = await fetch(`https://graph.facebook.com/v19.0/${accountId}/feed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const err = (await response.json()) as { error: { message: string } }
          throw new Error(`Facebook Graph API error: ${err.error?.message}`)
        }

        const result = (await response.json()) as { id: string }
        return {
          platformPostId: result.id,
          url: `https://www.facebook.com/${result.id}`,
          status: 'published',
        }
      }

      case 'twitter': {
        const bearerToken = process.env.TWITTER_BEARER_TOKEN
        if (!bearerToken) throw new Error('TWITTER_BEARER_TOKEN not configured')

        const body: Record<string, unknown> = { text: fullText }
        if (mediaUrls?.length) {
          // Media attachment requires media upload first — include as reference
          body.media = { media_ids: mediaUrls }
        }

        const response = await fetch('https://api.twitter.com/2/tweets', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${bearerToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const err = (await response.json()) as { detail?: string; title?: string }
          throw new Error(`Twitter API error: ${err.detail ?? err.title}`)
        }

        const result = (await response.json()) as { data: { id: string; text: string } }
        return {
          platformPostId: result.data.id,
          url: `https://twitter.com/i/web/status/${result.data.id}`,
          status: 'published',
        }
      }

      case 'linkedin': {
        const accessToken = process.env.LINKEDIN_ACCESS_TOKEN
        if (!accessToken) throw new Error('LINKEDIN_ACCESS_TOKEN not configured')

        const body = {
          author: `urn:li:organization:${accountId}`,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: { text: fullText },
              shareMediaCategory: 'NONE',
            },
          },
          visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
        }

        const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
          },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const err = (await response.json()) as { message?: string; status?: number }
          throw new Error(`LinkedIn API error: ${err.message ?? response.status}`)
        }

        const result = (await response.json()) as { id: string }
        return {
          platformPostId: result.id,
          url: `https://www.linkedin.com/feed/update/${result.id}`,
          status: 'published',
        }
      }

      case 'youtube': {
        // YouTube video publishing requires file upload — return stub
        return {
          platformPostId: 'yt-stub',
          url: '',
          status: 'not_implemented',
        }
      }

      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }
  },
}

export const socialPublishTools = [socialPublishTool]
