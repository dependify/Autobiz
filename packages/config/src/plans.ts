/**
 * Subscription plan definitions for Dependify
 */

export type PlanCode = 'starter' | 'growth' | 'scale' | 'enterprise'

export interface PlanFeatures {
  maxContacts: number
  maxTeamMembers: number
  maxSocialAccounts: number
  contentGenerationsPerMonth: number
  aiAssistantMessages: number
  voiceMinutesPerMonth: number
  websiteEnabled: boolean
  proposalsEnabled: boolean
  accountingEnabled: boolean
  voiceAgentEnabled: boolean
  apiAccess: boolean
  whitelabelEnabled: boolean
  prioritySupport: boolean
}

export interface PlanConfig {
  code: PlanCode
  name: string
  description: string
  monthlyPriceUSD: number
  yearlyPriceUSD: number
  features: PlanFeatures
}

export const PLANS: Record<PlanCode, PlanConfig> = {
  starter: {
    code: 'starter',
    name: 'Starter',
    description: 'Perfect for solo businesses and freelancers',
    monthlyPriceUSD: 29,
    yearlyPriceUSD: 290,
    features: {
      maxContacts: 500,
      maxTeamMembers: 1,
      maxSocialAccounts: 3,
      contentGenerationsPerMonth: 30,
      aiAssistantMessages: 100,
      voiceMinutesPerMonth: 0,
      websiteEnabled: true,
      proposalsEnabled: true,
      accountingEnabled: false,
      voiceAgentEnabled: false,
      apiAccess: false,
      whitelabelEnabled: false,
      prioritySupport: false,
    },
  },
  growth: {
    code: 'growth',
    name: 'Growth',
    description: 'For growing businesses with a small team',
    monthlyPriceUSD: 79,
    yearlyPriceUSD: 790,
    features: {
      maxContacts: 2500,
      maxTeamMembers: 5,
      maxSocialAccounts: 8,
      contentGenerationsPerMonth: 150,
      aiAssistantMessages: 500,
      voiceMinutesPerMonth: 120,
      websiteEnabled: true,
      proposalsEnabled: true,
      accountingEnabled: true,
      voiceAgentEnabled: true,
      apiAccess: false,
      whitelabelEnabled: false,
      prioritySupport: false,
    },
  },
  scale: {
    code: 'scale',
    name: 'Scale',
    description: 'For established businesses ready to scale',
    monthlyPriceUSD: 199,
    yearlyPriceUSD: 1990,
    features: {
      maxContacts: 10000,
      maxTeamMembers: 15,
      maxSocialAccounts: 20,
      contentGenerationsPerMonth: 500,
      aiAssistantMessages: 2000,
      voiceMinutesPerMonth: 600,
      websiteEnabled: true,
      proposalsEnabled: true,
      accountingEnabled: true,
      voiceAgentEnabled: true,
      apiAccess: true,
      whitelabelEnabled: false,
      prioritySupport: true,
    },
  },
  enterprise: {
    code: 'enterprise',
    name: 'Enterprise',
    description: 'Custom solution for large organizations',
    monthlyPriceUSD: -1, // Custom pricing
    yearlyPriceUSD: -1,
    features: {
      maxContacts: -1, // Unlimited
      maxTeamMembers: -1,
      maxSocialAccounts: -1,
      contentGenerationsPerMonth: -1,
      aiAssistantMessages: -1,
      voiceMinutesPerMonth: -1,
      websiteEnabled: true,
      proposalsEnabled: true,
      accountingEnabled: true,
      voiceAgentEnabled: true,
      apiAccess: true,
      whitelabelEnabled: true,
      prioritySupport: true,
    },
  },
}
