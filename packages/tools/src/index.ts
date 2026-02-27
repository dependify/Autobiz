// ─── Communication ────────────────────────────────────────────────────────────
export { communicationTools } from './communication/email.tool'
export { voiceTools } from './communication/voice.tool'
export { whatsappTools } from './communication/whatsapp.tool'
export { emailSmtpTools } from './communication/email-smtp.tool'

// ─── Payment ──────────────────────────────────────────────────────────────────
export { paystackTools } from './payment/paystack.tool'
export { stripeTools } from './payment/stripe.tool'
export { flutterwaveTools } from './payment/flutterwave.tool'

// ─── Social ───────────────────────────────────────────────────────────────────
export { socialPublishTools } from './social/publish.tool'
export { socialMetricsTools } from './social/metrics.tool'
export { socialScheduleTools } from './social/schedule.tool'

// ─── SEO ──────────────────────────────────────────────────────────────────────
export { gscTools } from './seo/google-search-console.tool'
export { ga4Tools } from './seo/google-analytics.tool'
export { serpapiTools } from './seo/serpapi.tool'
export { dataforseoTools } from './seo/dataforseo.tool'
export { mozTools } from './seo/moz.tool'

// ─── Media ────────────────────────────────────────────────────────────────────
export { stableDiffusionTools } from './media/stable-diffusion.tool'
export { unsplashTools } from './media/unsplash.tool'
export { pexelsTools } from './media/pexels.tool'

// ─── Scraping ─────────────────────────────────────────────────────────────────
export { firecrawlTools } from './scraping/firecrawl.tool'
export { playwrightTools } from './scraping/playwright.tool'

// ─── Storage ──────────────────────────────────────────────────────────────────
export { minioTools } from './storage/minio.tool'
export { r2Tools } from './storage/cloudflare-r2.tool'
export { pdfTools } from './storage/pdf-generation.tool'

// ─── Enrichment ───────────────────────────────────────────────────────────────
export { hunterTools } from './enrichment/hunter.tool'
export { apolloTools } from './enrichment/apollo.tool'
export { googleMapsTools } from './enrichment/google-maps.tool'
export { openExchangeTools } from './enrichment/open-exchange.tool'
export { exchangeRateTools } from './enrichment/exchangerate-api.tool'

// ─── All Tools Combined ───────────────────────────────────────────────────────
import { communicationTools } from './communication/email.tool'
import { voiceTools } from './communication/voice.tool'
import { whatsappTools } from './communication/whatsapp.tool'
import { emailSmtpTools } from './communication/email-smtp.tool'
import { paystackTools } from './payment/paystack.tool'
import { stripeTools } from './payment/stripe.tool'
import { flutterwaveTools } from './payment/flutterwave.tool'
import { socialPublishTools } from './social/publish.tool'
import { socialMetricsTools } from './social/metrics.tool'
import { socialScheduleTools } from './social/schedule.tool'
import { gscTools } from './seo/google-search-console.tool'
import { ga4Tools } from './seo/google-analytics.tool'
import { serpapiTools } from './seo/serpapi.tool'
import { dataforseoTools } from './seo/dataforseo.tool'
import { mozTools } from './seo/moz.tool'
import { stableDiffusionTools } from './media/stable-diffusion.tool'
import { unsplashTools } from './media/unsplash.tool'
import { pexelsTools } from './media/pexels.tool'
import { firecrawlTools } from './scraping/firecrawl.tool'
import { playwrightTools } from './scraping/playwright.tool'
import { minioTools } from './storage/minio.tool'
import { r2Tools } from './storage/cloudflare-r2.tool'
import { pdfTools } from './storage/pdf-generation.tool'
import { hunterTools } from './enrichment/hunter.tool'
import { apolloTools } from './enrichment/apollo.tool'
import { googleMapsTools } from './enrichment/google-maps.tool'
import { openExchangeTools } from './enrichment/open-exchange.tool'
import { exchangeRateTools } from './enrichment/exchangerate-api.tool'

export const allTools = [
  // Communication
  ...communicationTools,
  ...voiceTools,
  ...whatsappTools,
  ...emailSmtpTools,
  // Payment
  ...paystackTools,
  ...stripeTools,
  ...flutterwaveTools,
  // Social
  ...socialPublishTools,
  ...socialMetricsTools,
  ...socialScheduleTools,
  // SEO
  ...gscTools,
  ...ga4Tools,
  ...serpapiTools,
  ...dataforseoTools,
  ...mozTools,
  // Media
  ...stableDiffusionTools,
  ...unsplashTools,
  ...pexelsTools,
  // Scraping
  ...firecrawlTools,
  ...playwrightTools,
  // Storage
  ...minioTools,
  ...r2Tools,
  ...pdfTools,
  // Enrichment
  ...hunterTools,
  ...apolloTools,
  ...googleMapsTools,
  ...openExchangeTools,
  ...exchangeRateTools,
]
