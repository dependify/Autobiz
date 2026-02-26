import type { DependifySkill, TenantContext } from '../types'
import { generateText, generateWithLocalFallback } from '../lib/ai-client'
import { AI_MODELS } from '@dependify/config'

export const blogGenerateSkill: DependifySkill = {
  id: 'content.blog.generate',
  name: 'Generate Blog Post',
  description: 'Generate a full, SEO-optimized blog post from a keyword and brief. Returns title, meta description, and full body with markdown formatting.',
  category: 'content',
  model: 'claude-sonnet',
  systemPrompt: 'You are an expert SEO content writer. Write engaging, well-researched blog posts that rank well in search engines. Use proper heading hierarchy (H1 for title, H2 for sections, H3 for subsections). Include the target keyword naturally throughout. Write in an authoritative but accessible tone.',
  inputSchema: {
    properties: {
      keyword: { type: 'string', description: 'Target SEO keyword' },
      topic: { type: 'string', description: 'Blog post topic or angle' },
      wordCount: { type: 'number', description: 'Target word count (default 1200)' },
      audience: { type: 'string', description: 'Target audience description' },
      tone: { type: 'string', description: 'Writing tone (professional, conversational, etc)' },
      market: { type: 'string', description: 'Market context (NG, US, UK, etc)' },
    },
    required: ['keyword', 'topic'],
  },
  async execute(input: unknown, context: TenantContext) {
    const { keyword, topic, wordCount = 1200, audience, tone = 'professional', market } = input as {
      keyword: string
      topic: string
      wordCount?: number
      audience?: string
      tone?: string
      market?: string
    }

    const prompt = `Write a ${wordCount}-word blog post for the following:
- Target keyword: "${keyword}"
- Topic: ${topic}
${audience ? `- Target audience: ${audience}` : ''}
- Tone: ${tone}
${market ? `- Market/region: ${market}` : ''}

Return a JSON object with:
{
  "title": "H1 title with keyword",
  "metaTitle": "60-char SEO title",
  "metaDescription": "155-char meta description",
  "body": "Full markdown body with H2/H3 headings",
  "estimatedReadTime": number (minutes),
  "suggestedTags": ["tag1", "tag2"]
}`

    const result = await generateText(prompt, blogGenerateSkill.systemPrompt, AI_MODELS.CLAUDE_SONNET)

    try {
      return JSON.parse(result)
    } catch {
      return { title: topic, body: result, metaDescription: '', suggestedTags: [] }
    }
  },
}

export const socialCaptionSkill: DependifySkill = {
  id: 'content.social.caption',
  name: 'Generate Social Caption',
  description: 'Generate an engaging social media caption optimized for a specific platform.',
  category: 'content',
  model: 'ollama-llama',
  systemPrompt: 'You are a social media content expert. Write captions that drive engagement and match each platform\'s best practices.',
  inputSchema: {
    properties: {
      platform: { type: 'string', enum: ['instagram', 'facebook', 'twitter', 'linkedin', 'tiktok'] },
      topic: { type: 'string' },
      tone: { type: 'string' },
      includeHashtags: { type: 'boolean' },
      contentSource: { type: 'string', description: 'Source content to base caption on' },
    },
    required: ['platform', 'topic'],
  },
  async execute(input: unknown, _context: TenantContext) {
    const { platform, topic, tone = 'engaging', includeHashtags = true, contentSource } = input as {
      platform: string
      topic: string
      tone?: string
      includeHashtags?: boolean
      contentSource?: string
    }

    const platformGuide: Record<string, string> = {
      instagram: 'Instagram: 125-150 words, storytelling, calls to action, 5-10 hashtags at end',
      facebook: 'Facebook: 40-80 words, question-based, conversational',
      twitter: 'Twitter: max 280 chars, punchy, trending hashtags',
      linkedin: 'LinkedIn: professional, insightful, 150-200 words, industry value',
      tiktok: 'TikTok: energetic, trend-aware, 100-150 chars',
    }

    const prompt = `Write a ${tone} ${platform} caption about: ${topic}
Platform guide: ${platformGuide[platform] ?? platformGuide.instagram}
${contentSource ? `Based on: ${contentSource}` : ''}
${includeHashtags ? 'Include relevant hashtags.' : 'No hashtags.'}

Return JSON: { "caption": "...", "hashtags": ["..."] }`

    const result = await generateWithLocalFallback(prompt, socialCaptionSkill.systemPrompt)

    try {
      return JSON.parse(result)
    } catch {
      return { caption: result, hashtags: [] }
    }
  },
}

export const repurposeSkill: DependifySkill = {
  id: 'content.repurpose',
  name: 'Repurpose Content',
  description: 'Repurpose a blog post or content piece into multiple formats (social posts, email newsletter, short-form snippets).',
  category: 'content',
  model: 'claude-sonnet',
  systemPrompt: 'You are a content repurposing expert. Transform long-form content into multiple engaging formats while preserving the core message and adapting tone for each medium.',
  inputSchema: {
    properties: {
      sourceContent: { type: 'string', description: 'Original content to repurpose' },
      sourceType: { type: 'string', enum: ['blog', 'social', 'email'] },
      targetFormats: {
        type: 'array',
        items: { type: 'string', enum: ['instagram', 'facebook', 'twitter', 'linkedin', 'email', 'threads'] },
      },
    },
    required: ['sourceContent', 'targetFormats'],
  },
  async execute(input: unknown, _context: TenantContext) {
    const { sourceContent, sourceType = 'blog', targetFormats } = input as {
      sourceContent: string
      sourceType?: string
      targetFormats: string[]
    }

    const prompt = `Repurpose this ${sourceType} into the following formats: ${targetFormats.join(', ')}

Original content:
${sourceContent.slice(0, 3000)}

Return JSON with each format as a key:
{
  "instagram": { "caption": "...", "hashtags": [...] },
  "facebook": { "caption": "..." },
  "twitter": { "tweets": ["tweet1", "tweet2", "tweet3"] },
  "linkedin": { "post": "..." },
  "email": { "subject": "...", "preview": "...", "body": "..." }
}
Only include requested formats.`

    const result = await generateText(prompt, repurposeSkill.systemPrompt, AI_MODELS.CLAUDE_SONNET)

    try {
      return JSON.parse(result)
    } catch {
      return { raw: result }
    }
  },
}

export const contentSkills = [blogGenerateSkill, socialCaptionSkill, repurposeSkill]
