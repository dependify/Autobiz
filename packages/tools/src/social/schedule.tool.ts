import type { DependifyTool } from '@dependify/orchestrator'

export const socialScheduleTool: DependifyTool = {
  id: 'tool.social.schedule',
  name: 'Schedule Social Media Post',
  description:
    'Schedule a social media post for future publication at a specific date and time. Registers the job with the internal scheduling service.',
  category: 'social',
  costProfile: 'free',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      postId: { type: 'string', description: 'ID of the existing post to schedule' },
      platform: {
        type: 'string',
        description: 'Target platform (facebook, instagram, twitter, linkedin)',
      },
      scheduledAt: { type: 'string', description: 'ISO 8601 datetime string for when to publish' },
      accountId: { type: 'string', description: 'Platform account/page ID to post from' },
    },
    required: ['postId', 'platform', 'scheduledAt', 'accountId'],
  },
  outputSchema: {
    properties: {
      jobId: { type: 'string', description: 'Scheduler job ID for tracking' },
      scheduledAt: { type: 'string', description: 'Confirmed scheduled datetime in ISO 8601' },
    },
  },
  async execute(input: unknown) {
    const { postId, platform, scheduledAt, accountId } = input as {
      postId: string
      platform: string
      scheduledAt: string
      accountId: string
    }

    const apiBase = process.env.API_URL ?? 'http://localhost:4000'

    const response = await fetch(`${apiBase}/api/social/posts/${postId}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduledAt, platform, accountId }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Schedule API error: ${response.status} - ${err}`)
    }

    const result = (await response.json()) as { jobId?: string; id?: string; scheduledAt?: string }

    return {
      jobId: result.jobId ?? result.id ?? `job-${Date.now()}`,
      scheduledAt: result.scheduledAt ?? scheduledAt,
    }
  },
}

export const socialScheduleTools = [socialScheduleTool]
