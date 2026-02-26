# Dependify — Comprehensive Architecture Decomposition

> **Master Reference Document** — Every component, every layer, every connection.
> A developer can pick up any item and know exactly what to build, where to put it, and what it connects to.

---

## 1. EXECUTIVE SUMMARY

### What Is Dependify?

A unified AI-orchestrated business operating system for SMEs across Nigeria, USA, UK, Australia, New Zealand, and Canada. One platform replacing CRM, social media management, SEO tools, invoicing, accounting, content creation, voice agents, and website management — all connected by an AI orchestration layer powered by Claude.

### Layer Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  FRONTEND — Next.js 15 + shadcn/ui + Convex (reactive)          │
│  11 dashboard modules + admin panel + client websites            │
├──────────────────────────────────────────────────────────────────┤
│  API GATEWAY — Hono.js + Zod + multi-tenant middleware           │
│  Auth, rate-limiting, logging, tenant isolation                  │
├──────────────────────────────────────────────────────────────────┤
│  AI ORCHESTRATOR — Claude Sonnet/Haiku + Ollama/Llama fallback   │
│  Intent Router → Tool Selector → Executor → Synthesizer          │
├──────────────────────────────────────────────────────────────────┤
│  SKILLS (32) — Atomic AI capabilities (SimStudio-configured)     │
│  TOOLS (36) — Deterministic API integrations (hardcoded)         │
│  PLUGINS (8) — Composite workflows (Activepieces)                │
├──────────────────────────────────────────────────────────────────┤
│  JOB QUEUES — BullMQ on Redis (8 queues, priority levels)        │
├──────────────────────────────────────────────────────────────────┤
│  DATA — PostgreSQL+pgvector | Redis | Convex | Weaviate          │
├──────────────────────────────────────────────────────────────────┤
│  INTEGRATIONS — Paystack/Stripe, Africa's Talking/Twilio,        │
│  Social APIs, SEO APIs, Docuseal, MinIO, Cloudflare              │
└──────────────────────────────────────────────────────────────────┘
```

### Current State vs Target State

| Layer | Exists | Needed | Total | % Complete |
|---|---|---|---|---|
| **Skills** | 5 | 27 | 32 | 16% |
| **Tools** | 3 | 33 | 36 | 8% |
| **Plugins** | 0 | 8 | 8 | 0% |
| **API Routes** | 3 (health, auth, crm/contacts) | ~40 | ~43 | 7% |
| **Queue Workers** | 3 (email, social, content) | 5 | 8 | 38% |
| **Dashboard Pages** | 0 (11 stubs) | 11 | 11 | 0% |
| **DB Schemas** | 7 files | 0 | 7 | 100% |
| **Infrastructure** | Docker compose base | Monitoring, AI models | — | ~50% |

---

## 2. AI ORCHESTRATOR — THE BRAIN

### Location
`packages/orchestrator/src/orchestrator.ts` (134 lines, fully implemented)

### How It Works

The orchestrator is a **hardcoded Node.js service** — not generated, not a workflow. It is the brain of the platform.

```
User Message
    ↓
[1] classifyIntent() — Claude Haiku classifies intent category + action
    ↓
[2] toolRegistry.getToolsForMarket() — Filter tools by tenant's market
    ↓
[3] toolRegistry.toClaudeTools() — Convert all skills+tools to Claude tool_use format
    ↓
[4] callClaude() — Send message + tools to Claude Sonnet
    ↓
[5] AGENTIC LOOP — While Claude returns tool_use:
    │   ├── Find tool/skill in registry
    │   ├── Execute tool.execute(input, tenantContext)
    │   ├── Return result to Claude
    │   └── Claude decides: call more tools or respond
    ↓
[6] Extract final text response → Return OrchestratorResult
```

### Model Strategy

| Model | Constant | Use Case | Cost |
|---|---|---|---|
| Claude Sonnet 4.5 | `AI_MODELS.CLAUDE_SONNET` | Complex orchestration, proposal writing, analysis | Per-token (primary) |
| Claude Haiku 4.5 | `AI_MODELS.CLAUDE_HAIKU` | Intent classification, quick tool selection, simple tasks | Per-token (cheapest) |
| Ollama Llama 3.1 8B | `AI_MODELS.OLLAMA_LLAMA` | High-volume social captions, hashtags, sentiment | Free (self-hosted) |
| Whisper (self-hosted) | N/A | Voice transcription (STT) | Free |
| Chatterbox TTS (self-hosted) | N/A | Voice synthesis for agent | Free |

**Fallback Chain:** Claude Sonnet → Claude Haiku → Local Llama 3.1

### Core Interfaces (Contract)

**File:** `packages/orchestrator/src/types.ts`

```typescript
interface DependifyTool {
  id: string                    // e.g. "tool.email.resend"
  name: string                  // Human-readable
  description: string           // Used by Claude to decide when to call
  category: ToolCategory        // crm | content | social | finance | voice | seo | website | communication | storage | enrichment
  inputSchema: Record<string, unknown>   // JSON Schema for parameters
  outputSchema: Record<string, unknown>  // JSON Schema for return value
  costProfile: 'free' | 'paid' | 'metered'
  marketSupport: MarketCode[]   // ['NG', 'US', 'UK', 'AU', 'NZ', 'CA']
  execute: (input: unknown, context: TenantContext) => Promise<unknown>
}

interface DependifySkill {
  id: string                    // e.g. "content.blog.generate"
  name: string
  description: string
  category: ToolCategory
  model: 'claude-sonnet' | 'claude-haiku' | 'ollama-llama'
  systemPrompt: string          // The AI persona for this skill
  inputSchema: Record<string, unknown>
  execute: (input: unknown, context: TenantContext) => Promise<unknown>
}
```

### Tool Registry (Singleton)

**File:** `packages/orchestrator/src/lib/tool-registry.ts`

- `register(tool)` / `registerSkill(skill)` — Add to registry
- `toClaudeTools()` — Converts all registered items to Claude's `tool_use` format (dots replaced with `__`)
- `getToolsForMarket(market)` — Filter tools by market code
- Auto-registration on import in `packages/orchestrator/src/index.ts`

---

## 3. SKILLS — 32 Atomic AI Capabilities

> Skills are AI-powered, single-purpose functions callable by the orchestrator.
> Each skill has a system prompt, a model assignment, and input/output schemas.
> Prompts are configured via SimStudio; execution wrappers are hardcoded.

### Canonical Pattern

**File:** `packages/orchestrator/src/skills/content.ts` — See `blogGenerateSkill` for the pattern:
1. Export a `DependifySkill` object with all required fields
2. `execute()` builds a prompt, calls `generateText()` or `generateWithLocalFallback()`
3. Parse JSON response, provide graceful fallback on parse failure
4. Export array at bottom: `export const contentSkills = [...]`

---

### 3.1 Content Skills (10 total — 3 exist, 7 needed)

#### SKILL-C01: `content.blog.generate` ✅ EXISTS
- **File:** `packages/orchestrator/src/skills/content.ts:5`
- **Model:** Claude Sonnet
- **Input:** `{ keyword, topic, wordCount?, audience?, tone?, market? }`
- **Output:** `{ title, metaTitle, metaDescription, body, estimatedReadTime, suggestedTags }`
- **System Prompt:** SEO content writer persona
- **Dependencies:** None (pure AI)
- **Market Behavior:** Market passed as context for regional relevance

#### SKILL-C02: `content.blog.outline` ❌ NEEDED
- **File:** `packages/orchestrator/src/skills/content.ts` (append)
- **Model:** Claude Haiku (fast, cheap for outlines)
- **Input:** `{ keyword: string, topic: string, audience?: string, sections?: number }`
- **Output:** `{ title: string, sections: Array<{ heading, keyPoints[], estimatedWords }>, totalEstimatedWords }`
- **System Prompt:** "You are an SEO content strategist. Create structured blog outlines that target search intent and cover topics comprehensively."
- **Dependencies:** None
- **Market Behavior:** Universal — no variation

#### SKILL-C03: `content.social.caption` ✅ EXISTS
- **File:** `packages/orchestrator/src/skills/content.ts:60`
- **Model:** Ollama Llama (local, high-volume) → Claude Haiku fallback
- **Input:** `{ platform, topic, tone?, includeHashtags?, contentSource? }`
- **Output:** `{ caption, hashtags[] }`
- **System Prompt:** Social media content expert persona
- **Dependencies:** None

#### SKILL-C04: `content.social.hashtags` ❌ NEEDED
- **File:** `packages/orchestrator/src/skills/content.ts` (append)
- **Model:** Ollama Llama (local)
- **Input:** `{ topic: string, platform: string, count?: number, niche?: string }`
- **Output:** `{ hashtags: string[], trending: string[], niche: string[] }`
- **System Prompt:** "You are a social media hashtag researcher. Generate relevant, high-engagement hashtags organized by reach tier (broad, mid, niche)."
- **Dependencies:** None
- **Market Behavior:** NG gets Nigeria-specific trending tags; other markets get region-appropriate tags

#### SKILL-C05: `content.email.draft` ❌ NEEDED
- **File:** `packages/orchestrator/src/skills/content.ts` (append)
- **Model:** Claude Haiku
- **Input:** `{ type: 'marketing' | 'transactional' | 'followup' | 'newsletter', subject?, tone?, context: string, recipientInfo? }`
- **Output:** `{ subject, previewText, htmlBody, plainText }`
- **System Prompt:** "You are an email marketing expert. Write emails that get opened and drive action. Subject lines under 50 characters. Preview text under 90 characters."
- **Dependencies:** None
- **Market Behavior:** Currency formatting, greeting conventions vary by market

#### SKILL-C06: `content.repurpose` ✅ EXISTS
- **File:** `packages/orchestrator/src/skills/content.ts:111`
- **Model:** Claude Sonnet
- **Input:** `{ sourceContent, sourceType?, targetFormats[] }`
- **Output:** `{ [platform]: { caption/post/tweets/subject/body } }`
- **System Prompt:** Content repurposing expert persona

#### SKILL-C07: `content.seo.optimize` ❌ NEEDED
- **File:** `packages/orchestrator/src/skills/content.ts` (append)
- **Model:** Claude Sonnet
- **Input:** `{ content: string, targetKeyword: string, currentPosition?: number, competitorContent?: string }`
- **Output:** `{ optimizedContent, changes: Array<{ type, before, after }>, readabilityScore, keywordDensity }`
- **System Prompt:** "You are an SEO content optimizer. Improve content for search ranking while maintaining readability. Target 1-2% keyword density."
- **Dependencies:** None
- **Market Behavior:** None

#### SKILL-C08: `content.image.prompt` ❌ NEEDED
- **File:** `packages/orchestrator/src/skills/content.ts` (append)
- **Model:** Claude Haiku
- **Input:** `{ contentTitle: string, contentExcerpt: string, style?: string, dimensions?: string }`
- **Output:** `{ prompt, negativePrompt, suggestedStyle, dimensions: { width, height } }`
- **System Prompt:** "You are an AI art director. Generate Stable Diffusion prompts that produce professional, brand-safe images for business content."
- **Dependencies:** Output feeds into `tool.image.stable_diffusion`
- **Market Behavior:** None

#### SKILL-C09: `content.tone.adjust` ❌ NEEDED
- **File:** `packages/orchestrator/src/skills/content.ts` (append)
- **Model:** Claude Haiku
- **Input:** `{ content: string, currentTone: string, targetTone: string }`
- **Output:** `{ adjustedContent, toneAnalysis: { before, after } }`
- **System Prompt:** "You are a brand voice specialist. Adjust content tone while preserving meaning and key information."
- **Dependencies:** None
- **Market Behavior:** None

#### SKILL-C10: `content.localize` ❌ NEEDED
- **File:** `packages/orchestrator/src/skills/content.ts` (append)
- **Model:** Claude Sonnet (cultural nuance requires deeper model)
- **Input:** `{ content: string, sourceMarket: MarketCode, targetMarket: MarketCode, contentType: string }`
- **Output:** `{ localizedContent, changes: Array<{ type: 'currency' | 'idiom' | 'reference' | 'spelling', original, localized }> }`
- **System Prompt:** "You are a localization expert for business communications. Adapt content for target markets including currency references, cultural idioms, date formats, spelling conventions (US vs UK English), and cultural references."
- **Dependencies:** `@dependify/config` market configs for currency/date formatting
- **Market Behavior:** Core purpose of this skill — every market pair produces different output

---

### 3.2 CRM Skills (6 total — 2 exist, 4 needed)

#### SKILL-R01: `crm.contact.enrich` ❌ NEEDED
- **File:** `packages/orchestrator/src/skills/crm.ts` (append)
- **Model:** Claude Haiku
- **Input:** `{ contact: object, availableSignals: { email?, company?, domain?, socialProfiles? } }`
- **Output:** `{ enrichedFields: Record<string, unknown>, confidence: number, sources: string[] }`
- **System Prompt:** "You are a B2B data enrichment specialist. Infer company details, job roles, and social profiles from available signals."
- **Dependencies:** `tool.enrichment.hunter`, `tool.enrichment.apollo_free` (calls them for data, then synthesizes)
- **Market Behavior:** NG market uses different enrichment sources than US/UK

#### SKILL-R02: `crm.contact.score` ✅ EXISTS
- **File:** `packages/orchestrator/src/skills/crm.ts:5`
- **Model:** Claude Haiku
- **Input:** `{ contact: object, idealCustomerProfile?: object }`
- **Output:** `{ score, breakdown: { companyFit, roleFit, engagement, stageFit }, reasoning, nextBestAction }`

#### SKILL-R03: `crm.segment.suggest` ❌ NEEDED
- **File:** `packages/orchestrator/src/skills/crm.ts` (append)
- **Model:** Claude Sonnet
- **Input:** `{ contacts: Array<object>, currentSegments?: string[], businessType?: string }`
- **Output:** `{ segments: Array<{ name, criteria, estimatedSize, value }> }`
- **System Prompt:** "You are a CRM segmentation strategist. Analyze contact data to suggest actionable audience segments that drive targeted campaigns."
- **Dependencies:** Reads from contacts table (pgvector similarity for lookalike matching)
- **Market Behavior:** None

#### SKILL-R04: `crm.followup.suggest` ✅ EXISTS
- **File:** `packages/orchestrator/src/skills/crm.ts:61`
- **Model:** Claude Haiku
- **Input:** `{ contact, recentInteractions?, dealValue? }`
- **Output:** `{ action, priority, message, reasoning, bestTime, subject }`

#### SKILL-R05: `crm.sentiment.analyze` ❌ NEEDED
- **File:** `packages/orchestrator/src/skills/crm.ts` (append)
- **Model:** Ollama Llama (local, high volume)
- **Input:** `{ text: string, type: 'email' | 'call_transcript' | 'sms' | 'chat' }`
- **Output:** `{ score: number(-1 to 1), label: 'positive' | 'neutral' | 'negative', keywords: string[], urgency: 'low' | 'medium' | 'high' }`
- **System Prompt:** "You are a sentiment analysis specialist. Analyze business communications for emotional tone, urgency, and buying signals."
- **Dependencies:** None
- **Market Behavior:** None

#### SKILL-R06: `crm.deal.forecast` ❌ NEEDED
- **File:** `packages/orchestrator/src/skills/crm.ts` (append)
- **Model:** Claude Sonnet
- **Input:** `{ deal: object, contactHistory: Array<object>, pipelineStats?: object }`
- **Output:** `{ probability, estimatedCloseDate, risk: 'low' | 'medium' | 'high', recommendation, signals: Array<{ signal, impact }> }`
- **System Prompt:** "You are a sales forecasting analyst. Predict deal outcomes based on engagement patterns, pipeline velocity, and historical data."
- **Dependencies:** None
- **Market Behavior:** None

---

### 3.3 Proposal Skills (4 total — 0 exist, 4 needed)

**New file:** `packages/orchestrator/src/skills/proposals.ts`

#### SKILL-P01: `proposal.generate` ❌ NEEDED
- **Model:** Claude Sonnet
- **Input:** `{ templateId?, contactInfo, businessContext, services: Array<object>, projectScope }`
- **Output:** `{ sections: Array<{ type, title, body, data? }>, totalValue, estimatedTimeline }`
- **System Prompt:** "You are a proposal writer for professional services businesses. Write compelling, structured proposals that win clients. Include executive summary, scope, timeline, pricing, and terms."
- **Dependencies:** `proposal_templates` table for template retrieval
- **Market Behavior:** Currency formatting, tax calculations per market

#### SKILL-P02: `proposal.customize` ❌ NEEDED
- **Model:** Claude Sonnet
- **Input:** `{ proposal: object, clientPreferences: object, sectionToCustomize?: string }`
- **Output:** `{ customizedSections: Array<object>, reasoning: string }`
- **System Prompt:** "You are a proposal specialist. Customize proposals for specific client needs while maintaining professional structure."
- **Dependencies:** None
- **Market Behavior:** None

#### SKILL-P03: `proposal.pricing.suggest` ❌ NEEDED
- **Model:** Claude Sonnet
- **Input:** `{ services: Array<object>, market: MarketCode, complexity: string, clientBudget?: number }`
- **Output:** `{ lineItems: Array<{ description, quantity, unitPrice, total }>, totalBeforeTax, taxAmount, total, currency, pricingStrategy }`
- **Dependencies:** Market config for tax rates and currency
- **Market Behavior:** Currency, tax label, tax rate from `MARKETS[market]`

#### SKILL-P04: `proposal.followup.draft` ❌ NEEDED
- **Model:** Claude Haiku
- **Input:** `{ proposal: object, status: string, daysSinceSent: number, viewCount: number }`
- **Output:** `{ subject, body, callToAction, urgency }`
- **System Prompt:** "You are a sales follow-up specialist. Write follow-up messages that are persistent but professional."
- **Dependencies:** None
- **Market Behavior:** None

---

### 3.4 Finance Skills (4 total — 0 exist, 4 needed)

**New file:** `packages/orchestrator/src/skills/finance.ts`

#### SKILL-F01: `finance.categorize` ❌ NEEDED
- **Model:** Claude Haiku
- **Input:** `{ description: string, amount: number, type: 'income' | 'expense', existingCategories?: string[] }`
- **Output:** `{ category, subcategory?, confidence, taxDeductible: boolean }`
- **System Prompt:** "You are a business bookkeeper. Categorize transactions accurately using standard accounting categories."
- **Dependencies:** None
- **Market Behavior:** Tax deductibility varies by market

#### SKILL-F02: `finance.invoice.draft` ❌ NEEDED
- **Model:** Claude Haiku
- **Input:** `{ dealInfo?, conversationContext?, services: Array<object>, contactInfo, market: MarketCode }`
- **Output:** `{ lineItems: Array<object>, subtotal, taxRate, taxAmount, total, currency, dueDate, notes }`
- **Dependencies:** Market config for tax and currency
- **Market Behavior:** Tax rates, currency, due date conventions

#### SKILL-F03: `finance.report.summarize` ❌ NEEDED
- **Model:** Claude Sonnet
- **Input:** `{ transactions: Array<object>, period: { start, end }, currency: string }`
- **Output:** `{ summary, totalIncome, totalExpenses, netProfit, topCategories: Array<object>, insights: string[], alerts: string[] }`
- **Dependencies:** None
- **Market Behavior:** Currency formatting

#### SKILL-F04: `finance.cashflow.forecast` ❌ NEEDED
- **Model:** Claude Sonnet
- **Input:** `{ historicalTransactions[], pendingInvoices[], recurringExpenses[], forecastMonths: number }`
- **Output:** `{ monthlyProjections: Array<{ month, income, expenses, net, cumulativeBalance }>, healthScore, warnings[] }`
- **Dependencies:** None
- **Market Behavior:** Currency

---

### 3.5 Voice Skills (4 total — 0 exist, 4 needed)

**New file:** `packages/orchestrator/src/skills/voice.ts`

#### SKILL-V01: `voice.script.generate` ❌ NEEDED
- **Model:** Claude Sonnet
- **Input:** `{ campaignType: 'sales' | 'followup' | 'survey' | 'reminder', context, contactInfo?, businessName }`
- **Output:** `{ script, branches: Array<{ condition, response }>, estimatedDuration, objectionHandlers[] }`
- **System Prompt:** "You are a voice call script writer. Write natural-sounding scripts with branching logic for different conversation paths."
- **Dependencies:** None
- **Market Behavior:** NG uses more formal greetings; business hours awareness per timezone

#### SKILL-V02: `voice.transcript.summarize` ❌ NEEDED
- **Model:** Claude Haiku
- **Input:** `{ transcript: string, callDuration: number, direction: 'inbound' | 'outbound' }`
- **Output:** `{ summary, keyPoints[], actionItems[], nextSteps, sentiment }`
- **Dependencies:** None
- **Market Behavior:** None

#### SKILL-V03: `voice.sentiment.analyze` ❌ NEEDED
- **Model:** Ollama Llama (local)
- **Input:** `{ transcript: string }`
- **Output:** `{ overallSentiment: { score, label }, segments: Array<{ text, sentiment, timestamp? }>, buyingSignals[], objections[] }`
- **Dependencies:** None
- **Market Behavior:** None

#### SKILL-V04: `voice.followup.suggest` ❌ NEEDED
- **Model:** Claude Haiku
- **Input:** `{ callSummary, sentiment, contactStage, dealValue? }`
- **Output:** `{ action, priority, message, scheduleSuggestion, channel: 'email' | 'sms' | 'call' | 'whatsapp' }`
- **Dependencies:** None
- **Market Behavior:** NG prefers WhatsApp channel; other markets default to email

---

### 3.6 SEO Skills (4 total — 0 exist, 4 needed)

**New file:** `packages/orchestrator/src/skills/seo.ts`

#### SKILL-S01: `seo.keyword.research` ❌ NEEDED
- **Model:** Claude Sonnet
- **Input:** `{ topic, market: MarketCode, currentKeywords?, competitorDomains? }`
- **Output:** `{ keywords: Array<{ keyword, estimatedVolume, difficulty, intent, priority }>, clusters: Array<{ name, keywords[] }> }`
- **System Prompt:** "You are an SEO keyword researcher. Research keywords with commercial intent, grouped by topic clusters."
- **Dependencies:** `tool.seo.serpapi`, `tool.seo.dataforseo` for real volume/difficulty data
- **Market Behavior:** Search locale affects keyword data

#### SKILL-S02: `seo.competitor.analyze` ❌ NEEDED
- **Model:** Claude Sonnet
- **Input:** `{ domain, competitorDomains[], market: MarketCode }`
- **Output:** `{ gaps: Array<{ keyword, competitorRank, opportunity }>, strengths[], weaknesses[], contentOpportunities[] }`
- **Dependencies:** `tool.seo.dataforseo`, `tool.seo.moz_free`
- **Market Behavior:** Locale-specific SERPs

#### SKILL-S03: `seo.content.brief` ❌ NEEDED
- **Model:** Claude Sonnet
- **Input:** `{ keyword, searchIntent, competitorUrls?, wordCountTarget? }`
- **Output:** `{ title, outline: Array<{ heading, points[] }>, targetWordCount, relatedKeywords[], topicalAuthority[], contentType }`
- **Dependencies:** `tool.scrape.firecrawl` (for competitor page analysis)
- **Market Behavior:** None

#### SKILL-S04: `seo.meta.generate` ❌ NEEDED
- **Model:** Claude Haiku
- **Input:** `{ content, keyword, currentTitle?, currentDescription? }`
- **Output:** `{ title (60 chars), description (155 chars), ogTitle, ogDescription, slug }`
- **System Prompt:** "You are an SEO meta tag specialist. Write compelling meta titles (under 60 chars) and descriptions (under 155 chars) that drive click-through."
- **Dependencies:** None
- **Market Behavior:** None

---

## 4. TOOLS — 36 Deterministic Integrations

> Tools are deterministic — no AI inside them. They call external APIs and return structured data.
> Each tool conforms to the `DependifyTool` interface.

### Canonical Pattern

**File:** `packages/tools/src/communication/email.tool.ts` — See `emailResendTool` for the pattern:
1. Export a `DependifyTool` object
2. Check env var exists, throw if not
3. Make HTTP request to external API
4. Parse and return structured response
5. Export array at bottom: `export const communicationTools = [...]`

---

### 4.1 Communication Tools (7 total — 3 exist, 4 needed)

#### TOOL-COM01: `tool.email.resend` ✅ EXISTS
- **File:** `packages/tools/src/communication/email.tool.ts:3`
- **Service:** Resend | **Cost:** Free (3,000/mo) | **Markets:** All
- **Env:** `RESEND_API_KEY`, `EMAIL_FROM`

#### TOOL-COM02: `tool.sms.twilio` ✅ EXISTS
- **File:** `packages/tools/src/communication/email.tool.ts:63`
- **Service:** Twilio SMS | **Cost:** Metered | **Markets:** US, UK, AU, NZ, CA
- **Env:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

#### TOOL-COM03: `tool.sms.africas_talking` ✅ EXISTS
- **File:** `packages/tools/src/communication/email.tool.ts:118`
- **Service:** Africa's Talking SMS | **Cost:** Metered (cheap) | **Markets:** NG
- **Env:** `AFRICAS_TALKING_API_KEY`, `AFRICAS_TALKING_USERNAME`

#### TOOL-COM04: `tool.voice.africas_talking` ❌ NEEDED
- **File:** `packages/tools/src/communication/voice.tool.ts` (NEW)
- **Service:** Africa's Talking Voice API
- **Cost:** Metered (per-minute) | **Markets:** `['NG']`
- **Input:** `{ to: string, from?: string, callbackUrl: string }`
- **Output:** `{ sessionId, status }`
- **Rate Limit:** 5 concurrent calls per tenant
- **Caching:** None (real-time)
- **Env:** `AFRICAS_TALKING_API_KEY`, `AFRICAS_TALKING_USERNAME`

#### TOOL-COM05: `tool.voice.twilio` ❌ NEEDED
- **File:** `packages/tools/src/communication/voice.tool.ts` (append)
- **Service:** Twilio Programmable Voice
- **Cost:** Metered | **Markets:** `['US', 'UK', 'AU', 'NZ', 'CA']`
- **Input:** `{ to: string, from?: string, twiml?: string, callbackUrl: string }`
- **Output:** `{ callSid, status }`
- **Rate Limit:** 5 concurrent calls per tenant
- **Env:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

#### TOOL-COM06: `tool.email.nodemailer` ❌ NEEDED
- **File:** `packages/tools/src/communication/email-smtp.tool.ts` (NEW)
- **Service:** Nodemailer (self-hosted SMTP fallback)
- **Cost:** Free | **Markets:** All
- **Input:** `{ to: string | string[], subject, html, text?, from? }`
- **Output:** `{ messageId, success }`
- **Rate Limit:** 50/min per tenant
- **Env:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`

#### TOOL-COM07: `tool.whatsapp.baileys` ❌ NEEDED
- **File:** `packages/tools/src/communication/whatsapp.tool.ts` (NEW)
- **Service:** Baileys (open source WhatsApp Web API)
- **Cost:** Free | **Markets:** `['NG']` (primarily)
- **Input:** `{ to: string, message: string, mediaUrl?: string }`
- **Output:** `{ messageId, status }`
- **Rate Limit:** 20 messages/min per tenant
- **Caching:** Session persistence in Redis
- **Note:** Requires WhatsApp session management (QR code auth flow)

---

### 4.2 Payment Tools (3 total — 0 exist, 3 needed)

#### TOOL-PAY01: `tool.payment.paystack` ❌ NEEDED
- **File:** `packages/tools/src/payment/paystack.tool.ts` (NEW)
- **Service:** Paystack | **Cost:** 1.5% + ₦100/txn | **Markets:** `['NG']`
- **Input:** `{ email, amount, currency: 'NGN', reference?, callbackUrl?, metadata? }`
- **Output:** `{ authorizationUrl, accessCode, reference }`
- **Webhook:** `POST /api/webhooks/paystack` for payment confirmation
- **Env:** `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`

#### TOOL-PAY02: `tool.payment.stripe` ❌ NEEDED
- **File:** `packages/tools/src/payment/stripe.tool.ts` (NEW)
- **Service:** Stripe | **Cost:** 2.9% + $0.30/txn | **Markets:** `['US', 'UK', 'AU', 'NZ', 'CA']`
- **Input:** `{ amount, currency, customerEmail, description?, metadata? }`
- **Output:** `{ paymentIntentId, clientSecret, status }`
- **Webhook:** `POST /api/webhooks/stripe`
- **Env:** `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`

#### TOOL-PAY03: `tool.payment.flutterwave` ❌ NEEDED
- **File:** `packages/tools/src/payment/flutterwave.tool.ts` (NEW)
- **Service:** Flutterwave | **Cost:** Transaction % | **Markets:** `['NG']` (backup + diaspora)
- **Input:** `{ amount, currency, email, redirectUrl, metadata? }`
- **Output:** `{ paymentLink, transactionRef }`
- **Env:** `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_PUBLIC_KEY`

---

### 4.3 Social Media Tools (7 total — 0 exist, 7 needed)

#### TOOL-SOC01: `tool.social.publish` ❌ NEEDED
- **File:** `packages/tools/src/social/publish.tool.ts` (NEW)
- **Service:** Multi-platform publisher (platform-specific adapters)
- **Cost:** Free (API access) | **Markets:** All
- **Input:** `{ platform: SocialPlatform, accountId, content, mediaUrls?, hashtags? }`
- **Output:** `{ platformPostId, url, status }`
- **Rate Limit:** Per-platform API limits
- **Note:** OAuth tokens read from `social_accounts` table

#### TOOL-SOC02–SOC06: `tool.social.metrics.*` ❌ NEEDED
- **File:** `packages/tools/src/social/metrics.tool.ts` (NEW — single file, 5 exports)
- **Platforms:** Instagram, Facebook, Twitter, LinkedIn, YouTube
- **Cost:** Free | **Markets:** All
- **Input:** `{ accountId: string, period?: string, metrics?: string[] }`
- **Output:** `{ followers, engagement, reach, posts, topPost? }`
- **Caching:** `CACHE_TTL.SOCIAL_METRICS` (1 hour)
- **Env:** Platform-specific OAuth tokens from DB

#### TOOL-SOC07: `tool.social.schedule` ❌ NEEDED
- **File:** `packages/tools/src/social/schedule.tool.ts` (NEW)
- **Service:** Internal scheduling via BullMQ delayed jobs
- **Cost:** Free | **Markets:** All
- **Input:** `{ postId, platform, scheduledAt, accountId }`
- **Output:** `{ jobId, scheduledAt }`
- **Uses:** `socialPublishQueue.add()` with delay

---

### 4.4 SEO & Analytics Tools (5 total — 0 exist, 5 needed)

#### TOOL-SEO01: `tool.seo.google_search_console` ❌ NEEDED
- **File:** `packages/tools/src/seo/google-search-console.tool.ts` (NEW)
- **Cost:** Free | **Markets:** All
- **Input:** `{ siteUrl, startDate, endDate, dimensions? }`
- **Output:** `{ rows: Array<{ keys, clicks, impressions, ctr, position }> }`
- **Caching:** `CACHE_TTL.SEO_DATA` (1 hour)
- **Env:** Google Service Account credentials (`GOOGLE_SERVICE_ACCOUNT_JSON`)

#### TOOL-SEO02: `tool.seo.google_analytics` ❌ NEEDED
- **File:** `packages/tools/src/seo/google-analytics.tool.ts` (NEW)
- **Cost:** Free | **Markets:** All
- **Input:** `{ propertyId, startDate, endDate, metrics[], dimensions? }`
- **Output:** `{ rows: Array<Record<string, unknown>>, totals }`
- **Caching:** 1 hour
- **Env:** `GOOGLE_ANALYTICS_PROPERTY_ID`, Google Service Account

#### TOOL-SEO03: `tool.seo.serpapi` ❌ NEEDED
- **File:** `packages/tools/src/seo/serpapi.tool.ts` (NEW)
- **Cost:** Paid (100 free/month, then $50/mo) | **Markets:** All
- **Input:** `{ keyword, location?, device? }`
- **Output:** `{ organicResults[], relatedSearches[], peopleAlsoAsk[] }`
- **Caching:** `CACHE_TTL.DAILY` (24 hours — cache aggressively)
- **Env:** `SERPAPI_KEY`

#### TOOL-SEO04: `tool.seo.dataforseo` ❌ NEEDED
- **File:** `packages/tools/src/seo/dataforseo.tool.ts` (NEW)
- **Cost:** Pay-per-use (~$0.0001/req) | **Markets:** All
- **Input:** `{ keyword, locationCode?, languageCode? }`
- **Output:** `{ volume, difficulty, cpc, competition, relatedKeywords[] }`
- **Caching:** `CACHE_TTL.DAILY` (24 hours)
- **Env:** `DATAFORSEO_EMAIL`, `DATAFORSEO_PASSWORD`

#### TOOL-SEO05: `tool.seo.moz_free` ❌ NEEDED
- **File:** `packages/tools/src/seo/moz.tool.ts` (NEW)
- **Cost:** Free (limited) | **Markets:** All
- **Input:** `{ url: string }`
- **Output:** `{ domainAuthority, pageAuthority, spamScore, linkCount }`
- **Caching:** `CACHE_TTL.WEEKLY` (7 days — DA changes slowly)
- **Env:** `MOZ_ACCESS_ID`, `MOZ_SECRET_KEY`

---

### 4.5 Content & Media Tools (6 total — 0 exist, 6 needed)

#### TOOL-MED01: `tool.image.stable_diffusion` ❌ NEEDED
- **File:** `packages/tools/src/media/stable-diffusion.tool.ts` (NEW)
- **Service:** Stable Diffusion (self-hosted) | **Cost:** Free | **Markets:** All
- **Input:** `{ prompt, negativePrompt?, width?, height?, steps?, seed? }`
- **Output:** `{ imageUrl, seed }`
- **Env:** `STABLE_DIFFUSION_URL` (local API endpoint)

#### TOOL-MED02: `tool.image.unsplash` ❌ NEEDED
- **File:** `packages/tools/src/media/unsplash.tool.ts` (NEW)
- **Service:** Unsplash API | **Cost:** Free (50 req/hour) | **Markets:** All
- **Input:** `{ query, count?, orientation? }`
- **Output:** `{ images: Array<{ url, thumbUrl, photographer, downloadUrl }> }`
- **Caching:** `CACHE_TTL.LONG` (1 hour)
- **Env:** `UNSPLASH_ACCESS_KEY`

#### TOOL-MED03: `tool.image.pexels` ❌ NEEDED
- **File:** `packages/tools/src/media/pexels.tool.ts` (NEW)
- **Service:** Pexels API | **Cost:** Free | **Markets:** All
- **Input:** `{ query, count?, orientation? }`
- **Output:** `{ images: Array<{ url, thumbUrl, photographer }> }`
- **Env:** `PEXELS_API_KEY`

#### TOOL-MED04: `tool.video.shotstack` ❌ NEEDED (DEFER)
- **File:** `packages/tools/src/media/shotstack.tool.ts` (NEW)
- **Service:** Shotstack | **Cost:** Paid — defer until necessary | **Markets:** All
- **Note:** Low priority, only build when video features requested

#### TOOL-MED05: `tool.scrape.firecrawl` ❌ NEEDED
- **File:** `packages/tools/src/scraping/firecrawl.tool.ts` (NEW)
- **Service:** Firecrawl (self-hosted) | **Cost:** Free | **Markets:** All
- **Input:** `{ url: string, options?: { onlyMainContent?, includeMarkdown? } }`
- **Output:** `{ markdown, metadata: { title, description } }`
- **Env:** `FIRECRAWL_URL`

#### TOOL-MED06: `tool.scrape.playwright` ❌ NEEDED
- **File:** `packages/tools/src/scraping/playwright.tool.ts` (NEW)
- **Service:** Playwright browser automation | **Cost:** Free | **Markets:** All
- **Input:** `{ url, selector?, waitFor?, screenshot? }`
- **Output:** `{ html?, text?, screenshotUrl? }`
- **Note:** Heavy resource — use Firecrawl first, Playwright as fallback

---

### 4.6 Storage & File Tools (3 total — 0 exist, 3 needed)

#### TOOL-STO01: `tool.storage.minio` ❌ NEEDED
- **File:** `packages/tools/src/storage/minio.tool.ts` (NEW)
- **Service:** MinIO (self-hosted S3-compatible) | **Cost:** Free | **Markets:** All
- **Input:** `{ operation: 'upload' | 'download' | 'delete' | 'list', bucket, key, data? }`
- **Output:** `{ url, key, size? }`
- **Env:** `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`

#### TOOL-STO02: `tool.storage.cloudflare_r2` ❌ NEEDED
- **File:** `packages/tools/src/storage/cloudflare-r2.tool.ts` (NEW)
- **Service:** Cloudflare R2 | **Cost:** Free (10GB/mo) | **Markets:** All
- **Input:** `{ operation: 'upload' | 'download', key, data? }`
- **Output:** `{ url, key }`
- **Env:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET`

#### TOOL-STO03: `tool.pdf.generation` ❌ NEEDED
- **File:** `packages/tools/src/storage/pdf-generation.tool.ts` (NEW)
- **Service:** Puppeteer | **Cost:** Free | **Markets:** All
- **Input:** `{ html: string, options?: { format, landscape, margins } }`
- **Output:** `{ pdfBuffer: Buffer, url: string }` (uploaded to MinIO)
- **Dependencies:** `tool.storage.minio` for storing generated PDFs

---

### 4.7 CRM & Business Intelligence Tools (5 total — 0 exist, 5 needed)

#### TOOL-BI01: `tool.enrichment.hunter` ❌ NEEDED
- **File:** `packages/tools/src/enrichment/hunter.tool.ts` (NEW)
- **Service:** Hunter.io | **Cost:** Free (25 searches/month) | **Markets:** All
- **Input:** `{ email?: string, domain?: string }`
- **Output:** `{ email, firstName, lastName, position, company, linkedinUrl, confidence }`
- **Caching:** `CACHE_TTL.WEEKLY`
- **Env:** `HUNTER_API_KEY`

#### TOOL-BI02: `tool.enrichment.apollo_free` ❌ NEEDED
- **File:** `packages/tools/src/enrichment/apollo.tool.ts` (NEW)
- **Service:** Apollo.io free tier | **Cost:** Free (50 exports/mo) | **Markets:** All
- **Input:** `{ email?: string, domain?: string, firstName?, lastName? }`
- **Output:** `{ name, title, company, industry, employeeCount, linkedinUrl }`
- **Caching:** `CACHE_TTL.WEEKLY`
- **Env:** `APOLLO_API_KEY`

#### TOOL-BI03: `tool.maps.google` ❌ NEEDED
- **File:** `packages/tools/src/enrichment/google-maps.tool.ts` (NEW)
- **Service:** Google Maps Places API | **Cost:** Free ($200 credit/mo) | **Markets:** All
- **Input:** `{ query: string, location?, type? }`
- **Output:** `{ places: Array<{ name, address, phone, rating, website }> }`
- **Caching:** `CACHE_TTL.DAILY`
- **Env:** `GOOGLE_MAPS_API_KEY`

#### TOOL-BI04: `tool.currency.open_exchange` ❌ NEEDED
- **File:** `packages/tools/src/enrichment/open-exchange.tool.ts` (NEW)
- **Service:** Open Exchange Rates | **Cost:** Free (1,000 req/mo) | **Markets:** All
- **Input:** `{ base: string, symbols?: string[] }`
- **Output:** `{ rates: Record<string, number>, timestamp }`
- **Caching:** `CACHE_TTL.CURRENCY_RATES` (1 hour)
- **Env:** `OPEN_EXCHANGE_APP_ID`

#### TOOL-BI05: `tool.currency.exchangerate_api` ❌ NEEDED
- **File:** `packages/tools/src/enrichment/exchangerate-api.tool.ts` (NEW)
- **Service:** ExchangeRate-API | **Cost:** Free (1,500 req/mo) | **Markets:** All
- **Input:** `{ from: string, to: string, amount: number }`
- **Output:** `{ result: number, rate: number }`
- **Caching:** `CACHE_TTL.CURRENCY_RATES` (1 hour)
- **Note:** Fallback for `tool.currency.open_exchange`
- **Env:** `EXCHANGERATE_API_KEY`

---

## 5. PLUGINS — 8 Composite Workflows (Activepieces)

> Plugins combine multiple skills + tools into cohesive multi-step workflows.
> All plugins are configured in Activepieces with visual flow builders.
> Activepieces triggers hit backend webhooks; results update PostgreSQL + Convex.

---

### 5.1 `plugin.content.autopilot` — Full Content Pipeline

**Trigger:** Scheduled (weekly via cron) OR manual (dashboard button)

**Flow:**
1. Get tenant's target niche/topic from settings
2. Call `seo.keyword.research` → select top-priority keyword
3. Call `seo.content.brief` → generate structured brief
4. Call `content.blog.generate` → write full blog post
5. Call `content.seo.optimize` → optimize for target keyword
6. Save to `content_pieces` table with `status = 'review'`
7. Call `content.repurpose` → generate 5 social posts
8. Call `content.image.prompt` → create image prompt
9. Call `tool.image.stable_diffusion` → generate featured image
10. Call `tool.storage.minio` → upload image
11. Call `tool.social.schedule` → schedule social posts for optimal times
12. Push notification via Convex → "New content ready for review"

**Skills Used:** `seo.keyword.research`, `seo.content.brief`, `content.blog.generate`, `content.seo.optimize`, `content.repurpose`, `content.image.prompt`
**Tools Used:** `tool.seo.dataforseo`, `tool.image.stable_diffusion`, `tool.storage.minio`, `tool.social.schedule`
**Error Handling:** If any skill fails → mark `content_piece` as `failed` → log error → send notification → retry 2x with exponential backoff
**Monitoring:** Log step timing, token usage, output quality scores per run

---

### 5.2 `plugin.lead.nurture` — Automated Lead Nurture Sequence

**Trigger:** Event (new contact with score > threshold) OR scheduled (daily batch of stale leads)

**Flow:**
1. Get batch of contacts where `lastContactedAt > 3 days` or `score > 60`
2. For each contact: call `crm.contact.score` → re-score
3. Call `crm.followup.suggest` → determine best action
4. Call `content.email.draft` → draft personalized message
5. Send via appropriate channel:
   - Email → `tool.email.resend`
   - SMS (NG) → `tool.sms.africas_talking`
   - SMS (others) → `tool.sms.twilio`
6. Log `interaction` in DB
7. Update `lastContactedAt` on contact

**Skills Used:** `crm.contact.score`, `crm.followup.suggest`, `content.email.draft`
**Tools Used:** `tool.email.resend`, `tool.sms.twilio`, `tool.sms.africas_talking`
**Error Handling:** Skip contact on failure, continue batch. Alert on > 5% failure rate.
**Monitoring:** Track send rates, open rates, response rates per nurture cycle

---

### 5.3 `plugin.visitor.followup` — Voice/SMS Follow-up for New Contacts

**Trigger:** Webhook (new form submission on client website)

**Flow:**
1. Receive form submission webhook
2. Create contact in `contacts` table
3. Call `crm.contact.score` → immediate scoring
4. Call `voice.script.generate` → generate intro call script
5. Schedule call within business hours (respect tenant timezone)
6. Execute call via `tool.voice.africas_talking` (NG) or `tool.voice.twilio` (others)
7. If call answered: AI voice agent (Chatterbox TTS + Whisper STT + Llama response)
8. Post-call: transcribe → call `voice.transcript.summarize` → call `voice.sentiment.analyze`
9. Update contact with call data in DB
10. If no answer: send SMS fallback via `tool.sms.*`

**Skills Used:** `crm.contact.score`, `voice.script.generate`, `voice.transcript.summarize`, `voice.sentiment.analyze`
**Tools Used:** `tool.voice.africas_talking` / `tool.voice.twilio`, `tool.sms.*`
**Error Handling:** SMS fallback if voice fails → email as last resort
**Monitoring:** Call completion rate, answer rate, sentiment distribution

---

### 5.4 `plugin.proposal.pipeline` — Proposal Generation to Acceptance

**Trigger:** Manual (dashboard) OR event (deal stage = "proposal")

**Flow:**
1. Load deal + contact context from CRM
2. Call `proposal.generate` → create proposal content
3. Call `proposal.customize` → tailor for specific client
4. Call `proposal.pricing.suggest` → calculate pricing
5. Call `tool.pdf.generation` → render PDF
6. Call `tool.storage.minio` → store PDF
7. Create `proposals` record in DB (status = 'draft')
8. Send via `tool.email.resend` with tracking link
9. Update status to 'sent'
10. Schedule follow-up reminders (3 days, 7 days) via BullMQ

**Skills Used:** `proposal.generate`, `proposal.customize`, `proposal.pricing.suggest`
**Tools Used:** `tool.pdf.generation`, `tool.storage.minio`, `tool.email.resend`
**Error Handling:** If generation fails → create draft proposal for manual editing → notify user
**Monitoring:** Generation success rate, send-to-view time, view-to-accept rate

---

### 5.5 `plugin.invoice.auto` — Auto-Invoice on Deal Close

**Trigger:** Event (deal stage changed to `closed_won`)

**Flow:**
1. Receive deal close event with deal + contact data
2. Call `finance.invoice.draft` → draft invoice from deal data
3. Create `invoices` record in DB
4. Call `tool.pdf.generation` → render invoice PDF
5. Create payment link:
   - NG → `tool.payment.paystack`
   - Others → `tool.payment.stripe`
6. Send invoice via `tool.email.resend` with payment link
7. Schedule reminders via BullMQ:
   - Due date - 3 days (gentle reminder)
   - Due date (due today)
   - Due date + 3 days (overdue notice)
   - Due date + 7 days (final notice)

**Skills Used:** `finance.invoice.draft`
**Tools Used:** `tool.payment.paystack` / `tool.payment.stripe`, `tool.email.resend`, `tool.pdf.generation`
**Error Handling:** If payment provider fails → create invoice without link → notify for manual action
**Monitoring:** Invoice generation time, payment completion rate, days-to-payment

---

### 5.6 `plugin.seo.weekly` — Weekly SEO Health Report

**Trigger:** Scheduled (weekly, Monday morning in tenant timezone)

**Flow:**
1. Fetch keyword rankings from `tool.seo.google_search_console`
2. Update `keywords` table with current positions
3. Fetch traffic data from `tool.seo.google_analytics`
4. Call `seo.keyword.research` → identify new opportunities
5. Call `seo.competitor.analyze` → check competitor movements
6. Compile data into structured report
7. Call `content.blog.outline` → suggest next blog topics from SEO data
8. Save report record in DB
9. Notify tenant via Convex + email summary

**Skills Used:** `seo.keyword.research`, `seo.competitor.analyze`, `content.blog.outline`
**Tools Used:** `tool.seo.google_search_console`, `tool.seo.google_analytics`, `tool.seo.dataforseo`
**Error Handling:** If Google APIs fail → use cached data → note staleness in report
**Monitoring:** Report generation time, keyword tracking accuracy

---

### 5.7 `plugin.social.weekly_plan` — Weekly Social Content Plan

**Trigger:** Scheduled (weekly, Sunday evening)

**Flow:**
1. Get tenant's recent blog posts + content calendar
2. Call `content.social.caption` × 7 → one post per day
3. Call `content.social.hashtags` × 7 → hashtags per post
4. Call `content.image.prompt` × 7 → image prompts
5. Call `tool.image.stable_diffusion` × 7 → generate images (batch)
6. Call `tool.storage.minio` → upload all images
7. Create `social_posts` records in DB
8. Call `tool.social.schedule` × 7 → schedule across platforms for optimal times
9. Notify tenant with weekly plan preview

**Skills Used:** `content.social.caption`, `content.social.hashtags`, `content.image.prompt`
**Tools Used:** `tool.image.stable_diffusion`, `tool.storage.minio`, `tool.social.schedule`
**Error Handling:** If image generation fails → fallback to `tool.image.unsplash` / `tool.image.pexels`
**Monitoring:** Post engagement rates, scheduling reliability

---

### 5.8 `plugin.crm.inbox` — Unified Inbox

**Trigger:** Real-time (webhooks for incoming email, WhatsApp, SMS)

**Flow:**
1. Incoming message webhook received
2. Match to existing contact by email/phone
3. If no match: create new contact
4. Log `interaction` in DB (type = 'email' | 'whatsapp' | 'sms')
5. Call `crm.sentiment.analyze` → analyze message tone
6. If sentiment negative OR urgency high → immediate dashboard notification
7. Call `crm.followup.suggest` → suggest response
8. Push update to Convex → real-time dashboard refresh

**Skills Used:** `crm.sentiment.analyze`, `crm.followup.suggest`
**Tools Used:** `tool.whatsapp.baileys`, `tool.email.resend`
**Error Handling:** Queue unmatched messages for manual review → create "unknown contact" placeholder
**Monitoring:** Message volume, response time, sentiment trends

---

## 6. ACTIVEPIECES VS ORCHESTRATOR BOUNDARY

### What Goes in Activepieces (Multi-step, Scheduled, Event-driven)

| Category | Examples |
|---|---|
| **All 8 plugins** | Multi-step workflows with scheduling, retries, branching |
| **Scheduled cron jobs** | SEO weekly sync, social weekly plan, invoice reminders |
| **Event-driven triggers** | New contact, deal stage change, form submission, payment webhook |
| **Retry logic** | Configurable backoff on failures |
| **Visual debugging** | Non-developer modification of workflows |
| **Data transformation** | Between-step data mapping and branching |

### What Stays in Hardcoded Orchestrator (Real-time, Conversational)

| Category | Examples |
|---|---|
| **DependifyOrchestrator.process()** | Real-time intent classification + tool selection |
| **AI chat interactions** | Dashboard chat component → orchestrator |
| **Single-skill invocations** | API route triggers one skill directly (e.g., "score this contact now") |
| **Tool registry** | Singleton, Claude tool format conversion |
| **Conversation state** | PostgreSQL storage + Redis hot cache |

### Integration Pattern

```
                    ┌────────────────┐
                    │  Activepieces  │
                    │  (Workflow UI) │
                    └────────┬───────┘
                             │
              POST /api/webhooks/activepieces/{flowId}
                             │
                    ┌────────▼───────┐
                    │  Hono API      │
                    │  (Backend)     │──── POST {ACTIVEPIECES_URL}/api/v1/webhooks/{flowId}
                    └────────┬───────┘     (orchestrator can trigger flows too)
                             │
                    ┌────────▼───────┐
                    │  Orchestrator  │
                    │  + Skills      │
                    └────────┬───────┘
                             │
                    ┌────────▼───────┐
                    │  Tool Registry │
                    │  (36 tools)    │
                    └────────────────┘
```

### SimStudio's Role

SimStudio is used for **skill prompt configuration and testing**:
- Configure system prompts per skill
- Test skill inputs/outputs interactively
- Adjust model selection per skill
- A/B test different prompt strategies

SimStudio does NOT execute workflows — that's Activepieces.

---

## 7. HARDCODED BACKEND TASKS

### 7.1 API Routes Per Module

**Canonical pattern:** `apps/api/src/routes/crm/contacts.ts` — Hono router + `zValidator` + Drizzle ORM + `tenantId` from middleware.

#### CRM Module — `apps/api/src/routes/crm/`
| File | Status | Endpoints |
|---|---|---|
| `contacts.ts` | ✅ EXISTS | CRUD + add interaction + search + pagination |
| `deals.ts` | ❌ NEEDED | CRUD + stage transitions + pipeline stats |
| `interactions.ts` | ❌ NEEDED | List/search across all contacts |
| `segments.ts` | ❌ NEEDED | CRUD for saved segments |

#### Content Module — `apps/api/src/routes/content/`
| File | Status | Endpoints |
|---|---|---|
| `index.ts` | ❌ NEEDED | Sub-router mount |
| `pieces.ts` | ❌ NEEDED | CRUD + AI generation trigger + status workflow |
| `calendar.ts` | ❌ NEEDED | Calendar view (week/month) |
| `media.ts` | ❌ NEEDED | Media library (MinIO proxy for upload/list/delete) |

#### Social Module — `apps/api/src/routes/social/`
| File | Status | Endpoints |
|---|---|---|
| `accounts.ts` | ❌ NEEDED | OAuth connect/disconnect, list accounts |
| `posts.ts` | ❌ NEEDED | CRUD + schedule + publish + metrics |
| `analytics.ts` | ❌ NEEDED | Aggregated platform metrics |

#### SEO Module — `apps/api/src/routes/seo/`
| File | Status | Endpoints |
|---|---|---|
| `keywords.ts` | ❌ NEEDED | CRUD for tracked keywords + rank history |
| `analytics.ts` | ❌ NEEDED | Google Search Console + GA4 data proxy |
| `reports.ts` | ❌ NEEDED | Weekly report fetch + generation trigger |

#### Leads Module — `apps/api/src/routes/leads/`
| File | Status | Endpoints |
|---|---|---|
| `forms.ts` | ❌ NEEDED | Form builder CRUD + embed code generation |
| `submissions.ts` | ❌ NEEDED | Form submission handling + contact creation |
| `pipeline.ts` | ❌ NEEDED | Lead pipeline stats + conversion funnel |

#### Proposals Module — `apps/api/src/routes/proposals/`
| File | Status | Endpoints |
|---|---|---|
| `proposals.ts` | ❌ NEEDED | CRUD + generate + send + track views |
| `templates.ts` | ❌ NEEDED | Template CRUD |
| `public.ts` | ❌ NEEDED | Public proposal view (no auth, token-based) |

#### Invoices Module — `apps/api/src/routes/invoices/`
| File | Status | Endpoints |
|---|---|---|
| `invoices.ts` | ❌ NEEDED | CRUD + generate + send + remind |
| `payments.ts` | ❌ NEEDED | Payment link generation + status check |

#### Accounting Module — `apps/api/src/routes/accounting/`
| File | Status | Endpoints |
|---|---|---|
| `transactions.ts` | ❌ NEEDED | CRUD + auto-categorization trigger |
| `reports.ts` | ❌ NEEDED | P&L, cash flow, revenue by client/source |

#### Voice Module — `apps/api/src/routes/voice/`
| File | Status | Endpoints |
|---|---|---|
| `calls.ts` | ❌ NEEDED | Call log list + detail + initiate call |
| `campaigns.ts` | ❌ NEEDED | Campaign CRUD + start/pause/stop |
| `transcripts.ts` | ❌ NEEDED | Transcript search (Weaviate semantic search) |

#### Website Module — `apps/api/src/routes/website/`
| File | Status | Endpoints |
|---|---|---|
| `sites.ts` | ❌ NEEDED | Site CRUD + template selection |
| `deploy.ts` | ❌ NEEDED | Deployment trigger (Cloudflare Pages/Vercel) |

#### Settings Module — `apps/api/src/routes/settings/`
| File | Status | Endpoints |
|---|---|---|
| `team.ts` | ❌ NEEDED | Team member CRUD + invite |
| `integrations.ts` | ❌ NEEDED | API key management + OAuth connections |
| `billing.ts` | ❌ NEEDED | Plan management + subscription |

#### AI Module — `apps/api/src/routes/ai/`
| File | Status | Endpoints |
|---|---|---|
| `chat.ts` | ❌ NEEDED | Chat endpoint → orchestrator.process() |
| `skills.ts` | ❌ NEEDED | Direct skill invocation (POST with skillId + input) |

#### Webhooks — `apps/api/src/routes/webhooks/`
| File | Status | Endpoints |
|---|---|---|
| `paystack.ts` | ❌ NEEDED | Payment confirmation (verify signature) |
| `stripe.ts` | ❌ NEEDED | Payment events (verify webhook secret) |
| `activepieces.ts` | ❌ NEEDED | Plugin triggers (verify signature) |
| `forms.ts` | ❌ NEEDED | Client website form submissions |
| `voice-callback.ts` | ❌ NEEDED | Twilio/Africa's Talking voice callbacks |

---

### 7.2 Queue Workers

**Location:** `apps/api/src/queues/workers/`

| Worker | Status | Queue | Purpose |
|---|---|---|---|
| `email.worker.ts` | ✅ EXISTS | `email-send` | Send emails via Resend |
| `social-publish.worker.ts` | ✅ EXISTS | `social-publish` | Publish to social platforms |
| `content-generation.worker.ts` | ✅ EXISTS | `content-generation` | AI content generation |
| `voice-calls.worker.ts` | ❌ NEEDED | `voice-calls` | Process outbound voice call queue |
| `seo-sync.worker.ts` | ❌ NEEDED | `seo-sync` | Daily keyword rank tracking sync |
| `report-generation.worker.ts` | ❌ NEEDED | `report-generation` | Generate scheduled reports |
| `contact-enrich.worker.ts` | ❌ NEEDED | `contact-enrich` | Background contact enrichment |
| `invoice-reminder.worker.ts` | ❌ NEEDED | `invoice-reminder` | Scheduled invoice payment reminders |

---

### 7.3 Database Additions Needed

**RLS Policies (all tables):**
```sql
CREATE POLICY tenant_isolation ON {table}
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

**Missing Schemas (add to `packages/db/src/schema/`):**
- `lead_forms` — form builder configurations
- `form_submissions` — form submission data
- `notifications` — in-app notification queue
- `audit_log` — system-wide audit trail
- `website_sites` — client website configurations
- `website_templates` — available templates

**Indexes Needed:**
- `tenant_id` on every table (B-tree)
- `email` on contacts (unique per tenant)
- `keyword` on keywords (B-tree)
- Composite: `(tenant_id, created_at)` on high-query tables
- GIN index on `tags[]` columns for array search
- Vector index on embedding columns for similarity search

---

### 7.4 Redis Caching Strategies

| Data Type | TTL | Key Pattern |
|---|---|---|
| Tenant config | 10 min | `tenant:{id}:config` |
| User session | Redis session store | `session:{token}` |
| SEO API responses | 1 hour | `seo:{tenantId}:{endpoint}:{hash}` |
| Social metrics | 1 hour | `social:{tenantId}:{platform}:{accountId}` |
| Currency rates | 1 hour | `currency:{base}:{target}` |
| Contact lists | 1 min (high-change) | `contacts:{tenantId}:list:{page}` |
| Dashboard metrics | 5 min | `dashboard:{tenantId}:overview` |
| Rate limits | Per-window | `ratelimit:{tenantId}:{endpoint}` |

---

## 8. HARDCODED FRONTEND TASKS

### 8.1 Dashboard Pages (11 modules — all empty stubs)

**Location:** `apps/dashboard/src/app/dashboard/{module}/page.tsx`

| Module | Route | Key Components | Priority |
|---|---|---|---|
| **CRM** | `/dashboard/crm` | ContactList, ContactDetail, DealPipeline (Kanban), InteractionTimeline | Phase 1 |
| **Content** | `/dashboard/content` | ContentList, BlogEditor (Tiptap), ContentCalendar, AIGenerationModal | Phase 2 |
| **Social** | `/dashboard/social` | AccountManager, PostComposer, SchedulingQueue, AnalyticsDashboard | Phase 2 |
| **SEO** | `/dashboard/seo` | KeywordTracker, RankChangeChart, ContentPerformance, CompetitorView | Phase 3 |
| **Leads** | `/dashboard/leads` | LeadPipeline, FunnelChart, FormBuilder, SourceAttribution | Phase 3 |
| **Proposals** | `/dashboard/proposals` | ProposalList, ProposalEditor (Tiptap), TemplateSelector, PDFPreview | Phase 4 |
| **Invoices** | `/dashboard/invoices` | InvoiceList, InvoiceCreator, PaymentStatusTracker, ReminderManager | Phase 1 |
| **Accounting** | `/dashboard/accounting` | TransactionList, PnLChart, CashFlowChart, CategoryBreakdown | Phase 4 |
| **Voice** | `/dashboard/voice` | CampaignManager, CallLogList, TranscriptViewer, SentimentDisplay | Phase 5 |
| **Website** | `/dashboard/website` | TemplateBrowser, SiteSettings, DeploymentStatus, BlogSyncStatus | Phase 6 |
| **Settings** | `/dashboard/settings` | TeamManager, IntegrationHub, BillingPage, ProfileEditor | Phase 0 |

---

### 8.2 Component Library Extensions

**Location:** `apps/dashboard/src/components/`

| Component | Purpose | Library Base | Phase |
|---|---|---|---|
| `DataTable` | Sortable, filterable, paginated table | Radix + TanStack Table | Phase 0 |
| `KanbanBoard` | Drag-and-drop pipeline view | Custom (dnd-kit) | Phase 1 |
| `Calendar` | Content calendar (week/month) | Custom | Phase 2 |
| `RichTextEditor` | Blog/proposal editor | Tiptap | Phase 2 |
| `ChartCard` | Metric card with Recharts chart | Recharts + Radix | Phase 0 |
| `StatusBadge` | Color-coded status indicator | Radix Badge | Phase 0 |
| `EmptyState` | Placeholder for empty modules | Custom | Phase 0 |
| `ConfirmDialog` | Destructive action confirmation | Radix Dialog | Phase 0 |
| `FileUploader` | Drag-and-drop file upload | Custom | Phase 2 |
| `AIChatPanel` | Slide-out AI chat interface | Custom + Convex | Phase 1 |

---

### 8.3 State Management

**Zustand Stores** (`apps/dashboard/src/stores/`):
| Store | Purpose |
|---|---|
| `useAuthStore` | Current user, session, login/logout |
| `useTenantStore` | Tenant config, market, plan, settings |
| `useNotificationStore` | Notification queue, unread count |
| `useAIChatStore` | Chat history, pending state, tool results |

**TanStack Query Hooks** (`apps/dashboard/src/hooks/`):
- One custom hook per API endpoint: `useContacts()`, `useDeals()`, `useContentPieces()`, `useKeywords()`, `useInvoices()`, `useProposals()`, `useSocialPosts()`, `useCallLogs()`, `useTransactions()`

---

### 8.4 Convex Setup

**Location:** `packages/convex/` (NEW package) or `apps/dashboard/convex/`

| Function | Type | Purpose |
|---|---|---|
| `notifications.list` | Query | Real-time notification feed |
| `notifications.markRead` | Mutation | Mark notification as read |
| `taskProgress.get` | Query | "AI is generating your proposal..." live status |
| `taskProgress.update` | Mutation | Update task progress from backend |
| `activeCall.status` | Query | Live call status for voice module |
| `dashboard.metrics` | Query | Real-time KPI counters |

**Sync pattern:** PostgreSQL is source of truth → After any DB write, push state change to Convex via mutation → UI subscribes to Convex queries for instant updates.

---

## 9. INFRASTRUCTURE TASKS

### 9.1 Docker Compose Additions

**Current services:** PostgreSQL, Redis, MinIO, Weaviate, Ollama, Activepieces, Uptime Kuma

**Needed additions:**
| Service | Image | RAM | GPU? | Purpose |
|---|---|---|---|---|
| Whisper STT | `onerahmet/openai-whisper-asr-webservice` | Shared | ✅ | Voice transcription |
| Chatterbox TTS | Custom Dockerfile | Shared | ✅ | Voice synthesis |
| Stable Diffusion | `comfyanonymous/comfyui` | Shared | ✅ | Image generation |
| Firecrawl | Self-hosted | 1GB | ❌ | Web scraping |
| Prometheus | `prom/prometheus` | 512MB | ❌ | Metrics collection |
| Grafana | `grafana/grafana` | 512MB | ❌ | Metrics visualization |
| Loki | `grafana/loki` | 512MB | ❌ | Log aggregation |

### 9.2 Weaviate Schema Setup

| Collection | Fields | Purpose |
|---|---|---|
| `BusinessContent` | title, body, type, tenantId, publishedAt | Semantic content search |
| `ContactProfiles` | name, company, industry, tags, tenantId | Lookalike lead matching |
| `KnowledgeBase` | content, source, category, tenantId | RAG for AI assistant |
| `Templates` | name, type, description, industry | Intent-based template search |

### 9.3 Backup Strategy

- **PostgreSQL:** Daily `pg_dump` → MinIO bucket → replicate to Cloudflare R2
- **Redis:** AOF persistence (already configured)
- **MinIO:** Cross-bucket replication to R2
- **Weaviate:** Daily backup via Weaviate backup API

---

## 10. INTEGRATION ARCHITECTURE

### 10.1 Skill Registration
```
packages/orchestrator/src/skills/{domain}.ts
  → exports array: e.g. contentSkills, crmSkills, proposalSkills, financeSkills, voiceSkills, seoSkills
  → imported in packages/orchestrator/src/index.ts
  → auto-registered: toolRegistry.registerSkill(skill)
```

### 10.2 Tool Registration
```
packages/tools/src/{domain}/{tool}.tool.ts
  → exports array: e.g. communicationTools, paymentTools, socialTools
  → imported in apps/api/src/index.ts at startup
  → registered: toolRegistry.register(tool)
```

### 10.3 Activepieces → Backend
```
Activepieces workflow step → HTTP request
  → POST /api/webhooks/activepieces/{flowId}
  → API validates signature → routes to handler
  → Handler calls skills/tools as needed
  → Returns result to Activepieces for next step
```

### 10.4 Convex ↔ PostgreSQL
```
API writes to PostgreSQL (source of truth)
  → After write, calls syncToConvex(table, recordId, data)
  → Convex mutation updates real-time state
  → Dashboard React components subscribe to Convex queries
  → UI updates instantly without polling
```

### 10.5 Frontend → Orchestrator
```
Dashboard chat component
  → POST /api/ai/chat { message, conversationHistory }
  → API middleware adds TenantContext
  → orchestrator.process(input) runs agentic loop
  → Returns OrchestratorResult { response, toolsUsed, tokensUsed }
  → Dashboard renders response + shows tool activity
```

### 10.6 Client Websites → CRM
```
Client website form submit
  → POST /api/webhooks/forms { formId, data, source }
  → API creates contact in CRM
  → Triggers plugin.visitor.followup (if enabled)
  → Pushes notification via Convex
```

---

## 11. BUILD PHASE MAPPING

### Phase 0: Foundation (Weeks 1–3)
- [x] Hono.js API server with middleware
- [x] Better Auth + multi-tenancy
- [x] PostgreSQL schemas (all 7 files)
- [x] Redis + BullMQ queue infrastructure
- [ ] Convex project setup
- [x] Next.js dashboard scaffold + routing
- [x] Design system tokens
- [x] MinIO operational
- [x] Tool registry + orchestrator skeleton
- [ ] Basic tenant onboarding flow
- [ ] Settings page implementation
- [ ] DataTable, ChartCard, StatusBadge, EmptyState, ConfirmDialog components

### Phase 1: CRM + Invoicing (Weeks 4–7)
- [x] Contact CRUD (API route exists)
- [ ] Deal pipeline API + Kanban frontend
- [ ] Payment tools: `tool.payment.paystack`, `tool.payment.stripe`
- [ ] Invoice API routes + Invoice creator frontend
- [ ] PDF generation tool
- [ ] Invoice reminder worker
- [ ] CRM skills: `crm.contact.enrich`, `crm.segment.suggest`, `crm.sentiment.analyze`, `crm.deal.forecast`
- [ ] AI chat panel component
- [ ] `plugin.invoice.auto` Activepieces flow
- [ ] KanbanBoard component

### Phase 2: Content + Social (Weeks 8–12)
- [ ] Tiptap blog editor integration
- [ ] Social OAuth (all platforms)
- [ ] Social tools: `tool.social.publish`, `tool.social.metrics.*`, `tool.social.schedule`
- [ ] Content skills: `content.blog.outline`, `content.social.hashtags`, `content.email.draft`, `content.seo.optimize`, `content.image.prompt`, `content.tone.adjust`, `content.localize`
- [ ] Content calendar frontend
- [ ] Media library (MinIO integration)
- [ ] Social analytics dashboard
- [ ] `plugin.content.autopilot` flow
- [ ] `plugin.social.weekly_plan` flow
- [ ] Image tools: `tool.image.stable_diffusion`, `tool.image.unsplash`, `tool.image.pexels`
- [ ] Storage tools: `tool.storage.minio`, `tool.storage.cloudflare_r2`

### Phase 3: SEO + Lead Gen (Weeks 13–16)
- [ ] SEO tools: `tool.seo.google_search_console`, `tool.seo.google_analytics`, `tool.seo.serpapi`, `tool.seo.dataforseo`, `tool.seo.moz_free`
- [ ] SEO skills: `seo.keyword.research`, `seo.competitor.analyze`, `seo.content.brief`, `seo.meta.generate`
- [ ] Keyword tracker frontend
- [ ] SEO dashboard (rankings, traffic, performance)
- [ ] Lead capture form builder
- [ ] Form embed for client websites
- [ ] Lead pipeline dashboard
- [ ] Scraping tools: `tool.scrape.firecrawl`, `tool.scrape.playwright`
- [ ] `plugin.seo.weekly` flow
- [ ] SEO sync worker

### Phase 4: Proposals + Accounting (Weeks 17–20)
- [ ] Proposal skills: `proposal.generate`, `proposal.customize`, `proposal.pricing.suggest`, `proposal.followup.draft`
- [ ] Proposal template library
- [ ] Proposal editor (Tiptap) + PDF preview
- [ ] Docuseal e-signature integration
- [ ] Finance skills: `finance.categorize`, `finance.invoice.draft`, `finance.report.summarize`, `finance.cashflow.forecast`
- [ ] Transaction tracking + categorization frontend
- [ ] P&L and cash flow dashboard
- [ ] `plugin.proposal.pipeline` flow
- [ ] Enrichment tools: `tool.enrichment.hunter`, `tool.enrichment.apollo_free`
- [ ] Report generation worker

### Phase 5: Voice Agent (Weeks 21–25)
- [ ] Chatterbox TTS self-hosted setup
- [ ] Whisper STT self-hosted setup
- [ ] Voice tools: `tool.voice.africas_talking`, `tool.voice.twilio`
- [ ] Voice skills: `voice.script.generate`, `voice.transcript.summarize`, `voice.sentiment.analyze`, `voice.followup.suggest`
- [ ] Campaign manager frontend
- [ ] Call log + transcript viewer
- [ ] Voice calls worker
- [ ] `plugin.visitor.followup` flow
- [ ] `plugin.lead.nurture` flow
- [ ] WhatsApp tool: `tool.whatsapp.baileys`
- [ ] `plugin.crm.inbox` flow

### Phase 6: Client Website + Polish (Weeks 26–30)
- [ ] Website template library (5 templates × 3 industries)
- [ ] Cloudflare Pages deployment automation
- [ ] Blog sync (Dependify → client site)
- [ ] Currency tools: `tool.currency.open_exchange`, `tool.currency.exchangerate_api`
- [ ] Google Maps tool: `tool.maps.google`
- [ ] Weaviate semantic search fully integrated
- [ ] Full AI orchestrator with all 32 skills + 36 tools registered
- [ ] Dependify's own SaaS billing system
- [ ] Mobile responsiveness audit
- [ ] Monitoring stack (Prometheus + Grafana + Loki + Sentry)
- [ ] Load testing and performance optimization

---

## 12. SCORECARD — COMPLETE INVENTORY

| Layer | Total | Exists | Needed | % Complete |
|---|---|---|---|---|
| **Skills** | 32 | 5 | 27 | 16% |
| → Content | 10 | 3 | 7 | 30% |
| → CRM | 6 | 2 | 4 | 33% |
| → Proposals | 4 | 0 | 4 | 0% |
| → Finance | 4 | 0 | 4 | 0% |
| → Voice | 4 | 0 | 4 | 0% |
| → SEO | 4 | 0 | 4 | 0% |
| **Tools** | 36 | 3 | 33 | 8% |
| → Communication | 7 | 3 | 4 | 43% |
| → Payment | 3 | 0 | 3 | 0% |
| → Social Media | 7 | 0 | 7 | 0% |
| → SEO & Analytics | 5 | 0 | 5 | 0% |
| → Content & Media | 6 | 0 | 6 | 0% |
| → Storage & Files | 3 | 0 | 3 | 0% |
| → CRM & BI | 5 | 0 | 5 | 0% |
| **Plugins** | 8 | 0 | 8 | 0% |
| **API Routes** | ~43 | 3 | ~40 | 7% |
| **Queue Workers** | 8 | 3 | 5 | 38% |
| **Dashboard Pages** | 11 | 0 | 11 | 0% |
| **Components** | 10 | 2 | 8 | 20% |
| **Zustand Stores** | 4 | 0 | 4 | 0% |
| **Convex Functions** | 6 | 0 | 6 | 0% |
| **DB Schemas** | 7 | 7 | 0 | 100% |
| **Infrastructure** | — | ~50% | ~50% | 50% |
| | | | | |
| **GRAND TOTAL** | ~165 items | ~23 | ~142 | **14%** |

---

*Document Version: 1.0 | Generated: 2026-02-26 | Dependify LLC*
*Source of truth for the entire build. Every item mapped. Every connection documented.*
