# Dependify Business Operating System — Implementation Plan

> **Vision:** A unified AI-orchestrated business operating system for SMEs across Nigeria, USA, UK, Australia, New Zealand, and Canada. One platform replacing CRM, social media management, SEO tools, invoicing, accounting, content creation, voice agents, and website management — all connected by an AI orchestration layer.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Infrastructure & Data Layer](#2-infrastructure--data-layer)
3. [AI Orchestration Layer](#3-ai-orchestration-layer)
4. [Skills, Tools & Plugins Catalogue](#4-skills-tools--plugins-catalogue)
5. [Hardcoded Core Systems](#5-hardcoded-core-systems)
6. [Module Implementation Plans](#6-module-implementation-plans)
7. [API Strategy — Free & Open Source First](#7-api-strategy--free--open-source-first)
8. [Frontend & Dashboard Architecture](#8-frontend--dashboard-architecture)
9. [Multi-Market Configuration](#9-multi-market-configuration)
10. [Build Phases & Milestones](#10-build-phases--milestones)
11. [DevOps & Self-Hosting](#11-devops--self-hosting)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    DEPENDIFY PLATFORM                        │
├─────────────────────────────────────────────────────────────┤
│  FRONTEND LAYER                                              │
│  Next.js App Router + shadcn/ui + Convex (reactive)         │
│  ├── Client Dashboard (business owners)                      │
│  ├── Admin Panel (Dependify team)                            │
│  └── Client Websites (deployed per business)                 │
├─────────────────────────────────────────────────────────────┤
│  AI ORCHESTRATION LAYER                                      │
│  Claude Sonnet (primary) + local fallback (Ollama/Llama)    │
│  ├── Intent Router                                           │
│  ├── Tool Selector                                           │
│  ├── Multi-step Planner                                      │
│  └── Response Synthesizer                                    │
├─────────────────────────────────────────────────────────────┤
│  SKILLS / TOOLS / PLUGINS LAYER                             │
│  Activepieces (workflow engine) + SimStudio (AI flows)       │
│  ├── Skills (atomic AI capabilities)                         │
│  ├── Tools (integrations & APIs)                             │
│  └── Plugins (composite feature bundles)                     │
├─────────────────────────────────────────────────────────────┤
│  DATA LAYER                                                  │
│  PostgreSQL+pgvector | Redis | Convex | Weaviate             │
│  ├── Relational + vector: PostgreSQL (Supabase-compatible)   │
│  ├── Cache + queues + sessions: Redis                        │
│  ├── Reactive real-time state: Convex                        │
│  └── Semantic search & embeddings: Weaviate                  │
├─────────────────────────────────────────────────────────────┤
│  INTEGRATION LAYER                                           │
│  Market-specific APIs (Paystack/Stripe, Africa's Talking/    │
│  Twilio, social platforms, SEO tools)                        │
└─────────────────────────────────────────────────────────────┘
```

### Core Design Principles

- **AI orchestrates, humans configure** — business logic lives in skills/tools, AI decides sequencing
- **Separation of concerns** — data layer knows nothing about business rules, orchestrator knows nothing about storage details
- **Market-configurable** — single codebase, market-specific adapters (payments, telephony, currency)
- **Free/open source first** — paid APIs only where no viable alternative exists
- **Progressive disclosure** — simple dashboard for clients, deep config for power users

---

## 2. Infrastructure & Data Layer

### 2.1 PostgreSQL + pgvector (Primary Relational Store)

**Hardcoded schemas — these are the foundation and never generated dynamically:**

```sql
-- Core tenant/business identity
tenants (id, name, market, plan, settings_jsonb, created_at)
users (id, tenant_id, role, email, auth_provider, created_at)

-- CRM
contacts (id, tenant_id, name, email, phone, tags[], stage, source, vector embedding)
interactions (id, contact_id, type, content, sentiment_score, created_at)
deals (id, contact_id, stage, value, currency, probability, close_date)

-- Content
content_pieces (id, tenant_id, type, title, body, status, published_at, performance_jsonb)
keywords (id, tenant_id, keyword, volume, difficulty, position, tracked_at)

-- Finance
invoices (id, tenant_id, contact_id, line_items_jsonb, total, currency, status, due_date)
transactions (id, tenant_id, type, amount, currency, category, reference, date)

-- Voice & Communication
call_logs (id, tenant_id, contact_id, direction, duration, transcript, sentiment, created_at)
campaigns (id, tenant_id, type, status, audience_jsonb, schedule, results_jsonb)

-- Social Media
social_accounts (id, tenant_id, platform, access_token_enc, profile_jsonb)
social_posts (id, tenant_id, platform, content, media_urls[], status, scheduled_at, metrics_jsonb)

-- Proposals
proposals (id, tenant_id, contact_id, template_id, content_jsonb, status, viewed_at, accepted_at)
```

**Vector columns on:** contacts (for similarity matching), content_pieces (for semantic search/recommendations), call_logs (transcript embeddings for search)

### 2.2 Redis (Cache, Queues, Sessions)

**Usage:**
- Session storage (auth tokens, user state)
- Job queues (BullMQ) for async tasks: content generation, email sending, voice call scheduling
- Rate limiting per tenant per API
- Real-time pub/sub for dashboard notifications
- Short-lived cache for expensive API responses (SEO data, social metrics — cached 1hr)

### 2.3 Convex (Reactive Real-time Layer)

**What lives in Convex:**
- Live dashboard state (active calls, pending tasks, notification feed)
- Collaborative features (if multiple team members use the dashboard)
- Real-time metric counters that the UI subscribes to
- Orchestrator task status (so the UI can show "AI is generating your proposal...")

**Convex is the bridge between background processing and the live UI.** PostgreSQL holds the truth, Convex holds the present moment.

### 2.4 Weaviate (Semantic Search & Embeddings)

**Collections:**
- `BusinessContent` — all blog posts, social content for semantic similarity
- `ContactProfiles` — enriched contact embeddings for smart segmentation
- `KnowledgeBase` — business-specific knowledge for the AI assistant
- `Templates` — proposal and content templates searchable by intent

---

## 3. AI Orchestration Layer

### 3.1 Orchestrator Architecture

The orchestrator is a **hardcoded Node.js service** — not generated, not a workflow. It is the brain of the platform.

```typescript
// Core orchestrator loop (hardcoded)
class DependifyOrchestrator {
  async process(input: OrchestratorInput): Promise<OrchestratorResult> {
    // 1. Classify intent
    const intent = await this.classifyIntent(input)
    
    // 2. Select tools/skills needed
    const toolPlan = await this.planToolUse(intent)
    
    // 3. Execute tools (may be sequential or parallel)
    const results = await this.executeToolPlan(toolPlan)
    
    // 4. Synthesize and respond
    return this.synthesize(results, intent)
  }
}
```

### 3.2 Primary Model Strategy

| Model | Use Case | Cost Profile |
|---|---|---|
| Claude Sonnet 4.5 | Complex orchestration, proposal writing, analysis | Per-token, batched |
| Claude Haiku 4.5 | Simple classifications, quick tool selection | Per-token, cheapest |
| Ollama + Llama 3.1 8B (self-hosted) | High-volume repetitive tasks, social captions | Free after GPU cost |
| Whisper (self-hosted) | Voice transcription | Free, self-hosted |
| Chatterbox TTS (self-hosted) | Voice agent synthesis | Free, self-hosted |

### 3.3 Tool Registration Schema

Every skill and tool must be registered with this schema so the orchestrator can discover and use them:

```typescript
interface DependifyTool {
  id: string                    // e.g. "crm.contact.enrich"
  name: string                  // Human-readable
  description: string           // What the AI uses to decide when to call this
  category: ToolCategory        // crm | content | social | finance | voice | seo | website
  inputSchema: JSONSchema        // What parameters it expects
  outputSchema: JSONSchema       // What it returns
  costProfile: 'free' | 'paid' | 'metered'
  marketSupport: MarketCode[]   // ['NG', 'US', 'UK', 'AU', 'NZ', 'CA']
  execute: (input: any, context: TenantContext) => Promise<any>
}
```

---

## 4. Skills, Tools & Plugins Catalogue

### SKILLS — Atomic AI Capabilities
> Skills are AI-powered, single-purpose, callable by the orchestrator. Generated/configured via SimStudio.

#### Content Skills

| Skill ID | Description | Model | Notes |
|---|---|---|---|
| `content.blog.generate` | Generate full blog post from keyword + brief | Claude Sonnet | Includes SEO optimization |
| `content.blog.outline` | Generate blog outline from topic | Claude Haiku | Fast, cheap |
| `content.social.caption` | Generate social caption for platform | Llama 3.1 (local) | High volume, local model |
| `content.social.hashtags` | Generate relevant hashtags | Llama 3.1 (local) | |
| `content.email.draft` | Draft marketing or transactional email | Claude Haiku | |
| `content.repurpose` | Repurpose blog post to social/email/short | Claude Sonnet | Multi-format output |
| `content.seo.optimize` | Rewrite content for SEO target keyword | Claude Sonnet | |
| `content.image.prompt` | Generate Stable Diffusion prompt for content image | Claude Haiku | Feeds into image tool |
| `content.tone.adjust` | Rewrite content in specified brand tone | Claude Haiku | |
| `content.localize` | Adapt content for specific market (NG/US/UK etc) | Claude Sonnet | Cultural nuance |

#### CRM Skills

| Skill ID | Description | Model |
|---|---|---|
| `crm.contact.enrich` | Enrich contact from available signals | Claude Haiku |
| `crm.contact.score` | Lead score a contact based on behavior | Claude Haiku |
| `crm.segment.suggest` | Suggest audience segments from contact data | Claude Sonnet |
| `crm.followup.suggest` | Suggest next best action for a contact | Claude Sonnet |
| `crm.sentiment.analyze` | Analyze interaction sentiment | Local model |
| `crm.deal.forecast` | Forecast deal close probability | Claude Sonnet |

#### Proposal Skills

| Skill ID | Description |
|---|---|
| `proposal.generate` | Generate full proposal from template + context |
| `proposal.customize` | Customize proposal sections for specific client |
| `proposal.pricing.suggest` | Suggest pricing based on scope |
| `proposal.followup.draft` | Draft proposal follow-up message |

#### Finance Skills

| Skill ID | Description |
|---|---|
| `finance.categorize` | Auto-categorize transaction |
| `finance.invoice.draft` | Draft invoice from deal/conversation |
| `finance.report.summarize` | Summarize financial period in plain language |
| `finance.cashflow.forecast` | Simple cashflow projection |

#### Voice Skills

| Skill ID | Description |
|---|---|
| `voice.script.generate` | Generate call script for campaign type |
| `voice.transcript.summarize` | Summarize call transcript |
| `voice.sentiment.analyze` | Analyze call sentiment and intent |
| `voice.followup.suggest` | Suggest follow-up from call transcript |

#### SEO Skills

| Skill ID | Description |
|---|---|
| `seo.keyword.research` | Research keywords for topic |
| `seo.competitor.analyze` | Analyze competitor content gaps |
| `seo.content.brief` | Generate content brief from keyword data |
| `seo.meta.generate` | Generate title and meta description |

---

### TOOLS — Integrations & External APIs
> Tools are deterministic integrations. No AI inside them. They call APIs and return structured data.

#### Communication Tools

| Tool ID | Service | Free/Paid | Markets |
|---|---|---|---|
| `tool.sms.africas_talking` | Africa's Talking SMS | Pay-per-use (cheap) | NG |
| `tool.voice.africas_talking` | Africa's Talking Voice calls | Pay-per-use | NG |
| `tool.sms.twilio` | Twilio SMS | Pay-per-use | US/UK/AU/NZ/CA |
| `tool.voice.twilio` | Twilio Voice | Pay-per-use | US/UK/AU/NZ/CA |
| `tool.email.resend` | Resend transactional email | Free tier (3k/mo) | All |
| `tool.email.nodemailer` | Self-hosted SMTP fallback | Free | All |
| `tool.whatsapp.baileys` | WhatsApp via Baileys (open source) | Free | NG primarily |

#### Payment Tools

| Tool ID | Service | Notes |
|---|---|---|
| `tool.payment.paystack` | Paystack | NG market, Naira |
| `tool.payment.stripe` | Stripe | US/UK/AU/NZ/CA |
| `tool.payment.flutterwave` | Flutterwave | NG + diaspora |

#### Social Media Tools

| Tool ID | Service | Free/Paid |
|---|---|---|
| `tool.social.publish` | Publish to platform via official API | Free (API access) |
| `tool.social.metrics.instagram` | Instagram Insights API | Free |
| `tool.social.metrics.facebook` | Facebook Graph API | Free |
| `tool.social.metrics.twitter` | Twitter/X Basic API | Free tier limited |
| `tool.social.metrics.linkedin` | LinkedIn API | Free |
| `tool.social.metrics.youtube` | YouTube Data API | Free (10k units/day) |
| `tool.social.schedule` | Schedule post (internal queue via Redis/BullMQ) | Free |

#### SEO & Analytics Tools

| Tool ID | Service | Free/Paid |
|---|---|---|
| `tool.seo.google_search_console` | Google Search Console API | Free |
| `tool.seo.google_analytics` | Google Analytics 4 API | Free |
| `tool.seo.serpapi` | SerpAPI for SERP data | Paid (100 free/mo) |
| `tool.seo.dataforseo` | DataForSEO | Pay-per-use (cheap) |
| `tool.seo.moz_free` | Moz Free API (DA/PA) | Free (limited) |

#### Content & Media Tools

| Tool ID | Service | Free/Paid |
|---|---|---|
| `tool.image.stable_diffusion` | Stable Diffusion (self-hosted) | Free |
| `tool.image.unsplash` | Unsplash API for stock photos | Free |
| `tool.image.pexels` | Pexels API | Free |
| `tool.video.shotstack` | Video rendering API | Paid — avoid until necessary |
| `tool.scrape.firecrawl` | Firecrawl (open source, self-host) | Free self-hosted |
| `tool.scrape.playwright` | Playwright for web scraping | Free |

#### Storage & File Tools

| Tool ID | Service | Notes |
|---|---|---|
| `tool.storage.minio` | MinIO (self-hosted S3-compatible) | Free |
| `tool.storage.cloudflare_r2` | Cloudflare R2 | Free 10GB/mo |
| `tool.pdf.generation` | Puppeteer or Playwright PDF | Free |

#### CRM & Business Intelligence Tools

| Tool ID | Service | Notes |
|---|---|---|
| `tool.enrichment.hunter` | Hunter.io email finding | Free 25/mo |
| `tool.enrichment.apollo_free` | Apollo.io free tier | 50 exports/mo |
| `tool.maps.google` | Google Maps (business location data) | $200 free credit/mo |
| `tool.currency.open_exchange` | Open Exchange Rates | Free tier |
| `tool.currency.exchangerate_api` | ExchangeRate-API | Free 1500 req/mo |

---

### PLUGINS — Composite Feature Bundles
> Plugins combine multiple skills + tools into cohesive feature workflows. Configured in Activepieces.

| Plugin ID | Description | Skills Used | Tools Used |
|---|---|---|---|
| `plugin.content.autopilot` | Full content pipeline: keyword → brief → write → schedule → publish | content.blog.generate, content.social.caption, content.repurpose | tool.social.publish, tool.storage.minio |
| `plugin.lead.nurture` | Automated lead nurture sequence | crm.followup.suggest, content.email.draft | tool.email.resend, tool.sms.* |
| `plugin.visitor.followup` | Voice/SMS follow-up for new contacts | voice.script.generate | tool.voice.*, tool.sms.* |
| `plugin.proposal.pipeline` | Proposal generation through to acceptance tracking | proposal.generate, proposal.customize | tool.email.resend, tool.pdf.generation |
| `plugin.invoice.auto` | Auto-invoice from deal closed event | finance.invoice.draft | tool.payment.paystack/stripe, tool.email.resend |
| `plugin.seo.weekly` | Weekly SEO health report | seo.keyword.research, content.blog.outline | tool.seo.google_search_console, tool.seo.google_analytics |
| `plugin.social.weekly_plan` | Generate and schedule week's social content | content.social.caption, content.image.prompt | tool.image.stable_diffusion, tool.social.schedule |
| `plugin.crm.inbox` | Unified inbox: email + WhatsApp + SMS → CRM | crm.sentiment.analyze, crm.followup.suggest | tool.whatsapp.baileys, tool.email.resend |

---

## 5. Hardcoded Core Systems

These are **never AI-generated, never dynamic**. They are the bedrock of the platform.

### 5.1 Authentication & Multi-Tenancy

- **Library:** Better Auth (open source, self-hosted)
- Full multi-tenant isolation at database level (tenant_id on every table, RLS policies in PostgreSQL)
- Roles: `super_admin` (Dependify), `tenant_admin`, `tenant_member`, `client_viewer`
- OAuth: Google, email/password
- Session management via Redis

### 5.2 API Gateway / Backend

- **Framework:** Hono.js (fast, edge-compatible, TypeScript-first)
- Rate limiting per tenant per endpoint (Redis-backed)
- Request validation with Zod
- Structured logging with Pino

### 5.3 Job Queue System

- **Library:** BullMQ on Redis
- Queues: `content-generation`, `email-send`, `voice-calls`, `social-publish`, `seo-sync`, `report-generation`
- Priority levels: realtime → high → normal → low
- Dead letter queue for failed jobs with alerting

### 5.4 Orchestrator Service

- Hardcoded Node.js/TypeScript service
- Tool registry (all skills/tools register themselves on startup)
- Conversation state management (stored in PostgreSQL, hot state in Redis)
- Fallback logic: if Claude fails → retry with Haiku → retry with local Llama

### 5.5 Website Builder Engine

- Template library: 10-15 hand-crafted Next.js templates per industry
- CMS connection: blog posts from Dependify DB → rendered on client site
- Lead forms: submissions → directly into Dependify CRM
- Deployment: Cloudflare Pages or Vercel per client site

### 5.6 Notification System

- In-app: Convex real-time
- Email: Resend
- Push: web push via service worker
- Types: task completed, payment received, new lead, campaign finished

---

## 6. Module Implementation Plans

### Module 1: CRM & Contact Management

**Data:** PostgreSQL (contacts, interactions, deals)
**Real-time:** Convex (pipeline view, notification feed)
**AI:** Skills — enrich, score, followup.suggest
**Activepieces flows:** New contact → enrich → score → assign stage → trigger nurture if score > threshold

**Features:**
- Contact profiles with full interaction timeline
- Deal pipeline (Kanban view)
- Smart segmentation using vector similarity (pgvector)
- Bulk import CSV → auto-enrich
- Unified inbox (email + WhatsApp + SMS)

### Module 2: Content Creation & Publishing

**Data:** PostgreSQL (content_pieces), MinIO (media files)
**AI:** Skills — blog.generate, social.caption, repurpose, image.prompt
**Activepieces flows:** Content calendar → generate → review queue → approve → schedule → publish → track performance

**Features:**
- AI content brief generation from keyword
- Long-form blog editor (Tiptap — open source)
- Social media composer (multi-platform preview)
- Content calendar view
- Media library (MinIO-backed)
- Auto-repurpose: blog → 5 social posts → email newsletter

### Module 3: Social Media Management

**Data:** PostgreSQL (social_posts, social_accounts), Redis (scheduling queue)
**Tools:** Platform APIs (Graph, Twitter, LinkedIn, YouTube)
**Features:**
- Connect all major platforms (OAuth)
- Unified publishing queue
- Performance analytics (reach, engagement, follower growth)
- Best time to post (AI-analyzed from historical data)
- Competitor tracking (via scraping tools)

### Module 4: SEO & Website Analytics

**Data:** PostgreSQL (keywords), Redis (cache), Google APIs
**Tools:** Search Console, GA4, DataForSEO, SerpAPI
**Features:**
- Keyword rank tracker (daily sync)
- Site traffic overview (from GA4)
- Content performance scoring
- Technical SEO checklist
- Competitor keyword gap analysis
- AI-generated content briefs from keyword data

### Module 5: Lead Generation

**Data:** PostgreSQL (contacts, deals)
**AI:** Skills — crm.segment.suggest, crm.score
**Features:**
- Lead capture form builder (embeds on client website)
- Lead scoring dashboard
- Pipeline conversion funnel visualization
- Source attribution (which channel drives best leads)
- AI-suggested follow-up sequences

### Module 6: Proposals

**Data:** PostgreSQL (proposals), MinIO (PDF storage)
**AI:** Skills — proposal.generate, proposal.customize, proposal.pricing.suggest
**Features:**
- Template library (industry-specific)
- AI generation from CRM contact context
- Rich editor for customization (Tiptap)
- PDF export (Puppeteer)
- Send with view tracking (pixel or link tracking)
- E-signature (via open source: Docuseal)
- Status: draft → sent → viewed → accepted/rejected

### Module 7: Invoicing & Payments

**Data:** PostgreSQL (invoices, transactions)
**Tools:** Paystack (NG), Stripe (global), Flutterwave (NG backup)
**Features:**
- Create invoice from deal or manually
- Line items, taxes, discounts
- Multi-currency support
- Payment link generation (Paystack/Stripe)
- Automated payment reminders (BullMQ scheduled job)
- Recurring invoices
- Receipt generation (PDF)

### Module 8: Accounting & Numbers

**Data:** PostgreSQL (transactions)
**AI:** Skills — finance.categorize, finance.report.summarize
**Features:**
- Income & expense tracking
- Auto-categorization of transactions
- Simple P&L view (monthly/quarterly/yearly)
- Cash flow chart
- VAT/GST awareness per market (display only, not full compliance)
- Export to CSV (for their accountant)
- Revenue by client/source

### Module 9: Voice Agent System

**Data:** PostgreSQL (call_logs), Redis (active call state)
**AI:** Skills — voice.script.generate, voice.transcript.summarize, voice.sentiment.analyze
**Self-hosted:** Chatterbox TTS, Whisper STT, Llama for real-time response
**Tools:** Africa's Talking (NG), Twilio (global)
**Activepieces flows:** Trigger (new contact/campaign) → generate script → initiate call → transcribe → summarize → update CRM → suggest followup

**Features:**
- Outbound campaigns (automated calling sequences)
- Live call transcription
- Post-call summary and sentiment
- Call log with searchable transcripts (Weaviate)
- Voicemail detection and handling

### Module 10: Client Website

**Architecture:**
- Separate Next.js deployment per client (Cloudflare Pages — free)
- Template selection at onboarding
- Blog auto-synced from Dependify content module
- Lead forms submit to Dependify CRM via API
- Analytics auto-connected to GA4

---

## 7. API Strategy — Free & Open Source First

### Tier 1: Fully Free / Self-Hosted (Zero Ongoing Cost)

| Service | What For | How |
|---|---|---|
| Ollama + Llama 3.1 | High-volume AI tasks | Self-hosted on GPU server |
| Whisper | Voice transcription | Self-hosted |
| Chatterbox TTS | Voice synthesis | Self-hosted |
| Stable Diffusion | Image generation | Self-hosted |
| Weaviate | Vector search | Self-hosted Docker |
| MinIO | File storage | Self-hosted |
| Redis | Cache/queues | Self-hosted |
| PostgreSQL | Primary DB | Self-hosted |
| Firecrawl | Web scraping | Self-hosted |
| Baileys | WhatsApp | Open source library |
| Docuseal | E-signatures | Self-hosted |
| Tiptap | Rich text editor | Open source (MIT) |
| BullMQ | Job queues | Open source |
| Better Auth | Authentication | Open source |
| Hono.js | API framework | Open source |
| Puppeteer | PDF generation | Open source |
| Playwright | Scraping/testing | Open source |

### Tier 2: Free Tiers (Use Until Limits Hit)

| Service | Free Tier | When to Upgrade |
|---|---|---|
| Resend | 3,000 emails/month | At scale |
| Google Search Console API | Free | Never (always free) |
| Google Analytics 4 API | Free | Never |
| Unsplash API | 50 req/hour | Rarely needed |
| Pexels API | Free | Never (always free) |
| Hunter.io | 25 searches/month | Per client quota |
| Open Exchange Rates | 1,000 req/month | Cache aggressively |
| Cloudflare Pages | Free for hosting | Never (generous free tier) |
| Cloudflare R2 | 10GB free | After real storage needs |

### Tier 3: Pay-Per-Use (Minimal Cost, Necessary)

| Service | Cost | Notes |
|---|---|---|
| Claude API (Anthropic) | Per token | Primary AI — budget per tenant |
| Africa's Talking | Per SMS/minute | NG market only |
| Twilio | Per SMS/minute | Non-NG markets |
| Paystack | 1.5% + ₦100 per transaction | Only on successful payments |
| Stripe | 2.9% + $0.30 per transaction | Only on successful payments |
| DataForSEO | ~$0.0001 per request | Cheap, cache results |
| SerpAPI | 100 free/month, then $50/mo | Use sparingly, cache 24hrs |

### Tier 4: Paid (Only Where No Alternative)

| Service | Why Needed | Cost |
|---|---|---|
| Flutterwave | NG payment backup + diaspora | Transaction % |
| DataForSEO | No good free alternative at scale | Pay-per-use |

---

## 8. Frontend & Dashboard Architecture

### 8.1 Tech Stack

```
Next.js 15 (App Router)
├── shadcn/ui (base components)
├── Convex (real-time data subscriptions)
├── Tremor (charts and metrics components)
├── Tiptap (rich text editor for content module)
├── Zustand (client-side UI state)
├── React Query / TanStack Query (server state)
├── Recharts (custom charts where Tremor insufficient)
└── Tailwind CSS (styling)
```

### 8.2 Dashboard Layout

```
/dashboard
├── / (Business Health Overview — the command center)
├── /crm (Contacts, Pipeline, Deals)
│   ├── /contacts
│   ├── /pipeline
│   └── /interactions
├── /content (Content creation and calendar)
│   ├── /blog
│   ├── /social
│   └── /calendar
├── /social (Social media analytics)
├── /seo (Keywords and site performance)
├── /leads (Lead gen and forms)
├── /proposals
├── /invoices
├── /accounting
├── /voice (Call logs and campaigns)
├── /website (Client site management)
└── /settings (Integrations, team, billing)
```

### 8.3 Business Health Overview (Home Dashboard)

The homepage is the most important view. It shows:

- **Revenue this month** (vs last month %)
- **Open deals value**
- **New leads this week**
- **Top performing content piece**
- **Upcoming scheduled posts**
- **Pending invoices**
- **Recent calls summary**
- **AI Insight of the day** (one actionable recommendation from orchestrator)

### 8.4 Dependify Design System

Build on top of shadcn but define your own tokens:

```css
/* Brand tokens */
--dependify-primary: #1A1A2E     /* Deep navy */
--dependify-accent: #E94560      /* Energy red */
--dependify-surface: #16213E     /* Card surface */
--dependify-success: #0F9B58     /* Nigerian green nod */
--dependify-text: #EAEAEA

/* Market variants */
[data-market="NG"] { --dependify-accent: #008751 }  /* Nigerian flag green */
[data-market="US"] { --dependify-accent: #0052B4 }
```

---

## 9. Multi-Market Configuration

### Market Configuration Object

```typescript
const MARKETS: Record<MarketCode, MarketConfig> = {
  NG: {
    currency: 'NGN',
    currencySymbol: '₦',
    paymentProvider: 'paystack',
    telephonyProvider: 'africas_talking',
    taxLabel: 'VAT',
    taxRate: 0.075,
    dateFormat: 'DD/MM/YYYY',
    whatsappEnabled: true,
  },
  US: {
    currency: 'USD',
    currencySymbol: '$',
    paymentProvider: 'stripe',
    telephonyProvider: 'twilio',
    taxLabel: 'Sales Tax',
    taxRate: null, // varies by state
    dateFormat: 'MM/DD/YYYY',
    whatsappEnabled: false,
  },
  UK: {
    currency: 'GBP',
    currencySymbol: '£',
    paymentProvider: 'stripe',
    telephonyProvider: 'twilio',
    taxLabel: 'VAT',
    taxRate: 0.20,
    dateFormat: 'DD/MM/YYYY',
    whatsappEnabled: false,
  },
  AU: { currency: 'AUD', currencySymbol: 'A$', taxLabel: 'GST', taxRate: 0.10, /* ... */ },
  NZ: { currency: 'NZD', currencySymbol: 'NZ$', taxLabel: 'GST', taxRate: 0.15, /* ... */ },
  CA: { currency: 'CAD', currencySymbol: 'CA$', taxLabel: 'GST/HST', taxRate: 0.05, /* ... */ },
}
```

---

## 10. Build Phases & Milestones

### Phase 0: Foundation (Weeks 1–3)

**Goal:** Core infrastructure running, first client onboarded.

- [ ] Hono.js API server with multi-tenant middleware
- [ ] Better Auth with multi-tenancy
- [ ] PostgreSQL schema (all core tables, RLS policies)
- [ ] Redis + BullMQ job queue setup
- [ ] Convex project setup and core queries/mutations
- [ ] Next.js dashboard scaffold (routing, layout, auth)
- [ ] Dependify design system (shadcn + custom tokens)
- [ ] MinIO file storage operational
- [ ] Tool registry boilerplate (orchestrator skeleton)
- [ ] Basic tenant onboarding flow

### Phase 1: CRM + Invoicing (Weeks 4–7)

**Goal:** First client can manage contacts and get paid.

- [ ] Contact CRUD with full timeline
- [ ] Deal pipeline (Kanban)
- [ ] Paystack integration (NG) + Stripe (global)
- [ ] Invoice creation, PDF generation, payment links
- [ ] Automated payment reminders (BullMQ)
- [ ] Email via Resend
- [ ] CRM skills: enrich, score, followup.suggest
- [ ] Basic AI assistant (chat interface calling CRM skills)

### Phase 2: Content + Social (Weeks 8–12)

**Goal:** Clients can create and publish AI-assisted content.

- [ ] Blog editor (Tiptap integration)
- [ ] Social media account connections (OAuth)
- [ ] Social publishing tool + scheduling queue
- [ ] Content skills: blog.generate, social.caption, repurpose
- [ ] Content calendar view
- [ ] Media library (MinIO-backed)
- [ ] Social analytics dashboard
- [ ] `plugin.content.autopilot` Activepieces flow

### Phase 3: SEO + Lead Gen (Weeks 13–16)

**Goal:** Clients can track and grow their search presence.

- [ ] Google Search Console + GA4 integration
- [ ] Keyword tracking (daily sync job)
- [ ] SEO dashboard (rankings, traffic, content performance)
- [ ] Lead capture form builder
- [ ] Form embed for client websites
- [ ] Lead pipeline dashboard
- [ ] SEO skills: keyword.research, content.brief, meta.generate

### Phase 4: Proposals + Accounting (Weeks 17–20)

**Goal:** Full business finance loop closed.

- [ ] Proposal template library
- [ ] Proposal editor + PDF export
- [ ] Docuseal e-signature integration
- [ ] Proposal tracking (view events)
- [ ] Transaction tracking and categorization
- [ ] P&L and cash flow dashboard
- [ ] Finance skills: categorize, report.summarize, cashflow.forecast

### Phase 5: Voice Agent (Weeks 21–25)

**Goal:** Automated voice calling operational.

- [ ] Chatterbox TTS self-hosted setup
- [ ] Whisper STT self-hosted setup
- [ ] Africa's Talking voice integration (NG)
- [ ] Twilio voice integration (global)
- [ ] Call script generation (voice.script.generate skill)
- [ ] Live transcription pipeline
- [ ] Post-call CRM update automation
- [ ] `plugin.visitor.followup` flow

### Phase 6: Client Website + Polish (Weeks 26–30)

**Goal:** Full product ready for multi-market launch.

- [ ] Website template library (5 templates, 3 industries)
- [ ] Cloudflare Pages deployment automation
- [ ] Blog sync (Dependify → client site)
- [ ] Multi-market configuration (US, UK, AU, NZ, CA)
- [ ] Stripe integration for non-NG markets
- [ ] Twilio for non-NG telephony
- [ ] Weaviate semantic search fully integrated
- [ ] Full AI orchestrator with all skills registered
- [ ] Billing system (Dependify's own subscriptions)
- [ ] Mobile-responsive dashboard audit
- [ ] Load testing and performance optimization

---

## 11. DevOps & Self-Hosting

### Self-Hosted Services Stack

```yaml
# Recommended server setup (VPS or dedicated)
services:
  postgresql:
    image: pgvector/pgvector:pg16
    resources: 4GB RAM minimum
    
  redis:
    image: redis:7-alpine
    resources: 1GB RAM
    
  weaviate:
    image: semitechnologies/weaviate:latest
    resources: 4GB RAM
    
  minio:
    image: minio/minio:latest
    resources: 2GB RAM + storage
    
  ollama:
    image: ollama/ollama:latest
    resources: GPU server (minimum RTX 3080 for Llama 3.1 8B)
    
  whisper:
    image: onerahmet/openai-whisper-asr-webservice
    resources: Share GPU with Ollama
    
  chatterbox-tts:
    # Self-build from source
    resources: Share GPU
    
  stable-diffusion:
    image: automatic1111/stable-diffusion-webui
    resources: Share GPU

  activepieces:
    image: activepieces/activepieces:latest
    resources: 2GB RAM
```

### Recommended Server Configuration

**Nigeria (Primary):** VPS with GPU capability — consider Hetzner GPU servers or RunPod for GPU workloads

**Global CDN:** Cloudflare (free tier covers most needs — CDN, DDoS, Workers for edge)

**Database Backups:** Daily pg_dump to MinIO, replicated to Cloudflare R2

### Monitoring Stack (All Free/Open Source)

- **Uptime:** Uptime Kuma (self-hosted)
- **Metrics:** Prometheus + Grafana
- **Logs:** Loki (Grafana stack)
- **Error tracking:** Sentry (free tier for self-hosted)
- **Alerts:** Grafana alerting → Slack/email

---

## Summary: What's Generated vs Hardcoded

| Layer | Generated / Dynamic | Hardcoded |
|---|---|---|
| **Database schemas** | — | All schemas hardcoded |
| **API routes** | — | All routes hardcoded |
| **Auth & tenancy** | — | Hardcoded (Better Auth) |
| **Skills** | Prompts configured in SimStudio | Execution wrapper hardcoded |
| **Tools** | Tool schemas registered dynamically | Implementation hardcoded |
| **Plugins** | Flows built in Activepieces UI | Trigger/webhook endpoints hardcoded |
| **Orchestrator** | Tool selection is AI-generated at runtime | Orchestrator loop hardcoded |
| **Content** | AI-generated per request | Templates hardcoded |
| **Proposals** | AI-generated from templates | Template structure hardcoded |
| **Dashboard UI** | — | Hardcoded (Next.js) |
| **Market config** | — | Hardcoded per market |
| **Job queues** | Queue items created dynamically | Queue infrastructure hardcoded |

---

*Document Version: 1.0 | Dependify LLC | Built for Nigerian SMEs and the Global Market*
