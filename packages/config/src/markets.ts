/**
 * Multi-market configuration for Dependify
 * Supports: Nigeria (NG), United States (US), United Kingdom (UK),
 *           Australia (AU), New Zealand (NZ), Canada (CA)
 */

export type MarketCode = 'NG' | 'US' | 'UK' | 'AU' | 'NZ' | 'CA'

export type PaymentProvider = 'paystack' | 'stripe' | 'flutterwave'
export type TelephonyProvider = 'africas_talking' | 'twilio'

export interface MarketConfig {
  code: MarketCode
  name: string
  currency: string
  currencySymbol: string
  paymentProvider: PaymentProvider
  paymentProviderFallback?: PaymentProvider
  telephonyProvider: TelephonyProvider
  taxLabel: string
  taxRate: number | null // null = varies (e.g. US state tax)
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
  timezone: string
  whatsappEnabled: boolean
  smsEnabled: boolean
  voiceEnabled: boolean
}

export const MARKETS: Record<MarketCode, MarketConfig> = {
  NG: {
    code: 'NG',
    name: 'Nigeria',
    currency: 'NGN',
    currencySymbol: '₦',
    paymentProvider: 'paystack',
    paymentProviderFallback: 'flutterwave',
    telephonyProvider: 'africas_talking',
    taxLabel: 'VAT',
    taxRate: 0.075,
    dateFormat: 'DD/MM/YYYY',
    timezone: 'Africa/Lagos',
    whatsappEnabled: true,
    smsEnabled: true,
    voiceEnabled: true,
  },
  US: {
    code: 'US',
    name: 'United States',
    currency: 'USD',
    currencySymbol: '$',
    paymentProvider: 'stripe',
    telephonyProvider: 'twilio',
    taxLabel: 'Sales Tax',
    taxRate: null,
    dateFormat: 'MM/DD/YYYY',
    timezone: 'America/New_York',
    whatsappEnabled: false,
    smsEnabled: true,
    voiceEnabled: true,
  },
  UK: {
    code: 'UK',
    name: 'United Kingdom',
    currency: 'GBP',
    currencySymbol: '£',
    paymentProvider: 'stripe',
    telephonyProvider: 'twilio',
    taxLabel: 'VAT',
    taxRate: 0.20,
    dateFormat: 'DD/MM/YYYY',
    timezone: 'Europe/London',
    whatsappEnabled: false,
    smsEnabled: true,
    voiceEnabled: true,
  },
  AU: {
    code: 'AU',
    name: 'Australia',
    currency: 'AUD',
    currencySymbol: 'A$',
    paymentProvider: 'stripe',
    telephonyProvider: 'twilio',
    taxLabel: 'GST',
    taxRate: 0.10,
    dateFormat: 'DD/MM/YYYY',
    timezone: 'Australia/Sydney',
    whatsappEnabled: false,
    smsEnabled: true,
    voiceEnabled: true,
  },
  NZ: {
    code: 'NZ',
    name: 'New Zealand',
    currency: 'NZD',
    currencySymbol: 'NZ$',
    paymentProvider: 'stripe',
    telephonyProvider: 'twilio',
    taxLabel: 'GST',
    taxRate: 0.15,
    dateFormat: 'DD/MM/YYYY',
    timezone: 'Pacific/Auckland',
    whatsappEnabled: false,
    smsEnabled: true,
    voiceEnabled: true,
  },
  CA: {
    code: 'CA',
    name: 'Canada',
    currency: 'CAD',
    currencySymbol: 'CA$',
    paymentProvider: 'stripe',
    telephonyProvider: 'twilio',
    taxLabel: 'GST/HST',
    taxRate: 0.05,
    dateFormat: 'DD/MM/YYYY',
    timezone: 'America/Toronto',
    whatsappEnabled: false,
    smsEnabled: true,
    voiceEnabled: true,
  },
}

export function getMarket(code: MarketCode): MarketConfig {
  return MARKETS[code]
}

export function getAllMarkets(): MarketConfig[] {
  return Object.values(MARKETS)
}

export function getSupportedCurrencies(): string[] {
  return Object.values(MARKETS).map((m) => m.currency)
}
