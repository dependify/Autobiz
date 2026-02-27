import type { DependifyTool } from '@dependify/orchestrator'

export const stripeTool: DependifyTool = {
  id: 'tool.payment.stripe',
  name: 'Create Payment Intent via Stripe',
  description:
    'Create a Stripe PaymentIntent for US, UK, AU, NZ, and CA markets. Returns a client secret for completing payment on the frontend.',
  category: 'finance',
  costProfile: 'metered',
  marketSupport: ['US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      amount: {
        type: 'number',
        description: 'Amount in the major currency unit (e.g. dollars, not cents)',
      },
      currency: { type: 'string', description: 'ISO currency code (e.g. usd, gbp, aud)' },
      customerEmail: { type: 'string', description: 'Customer email for receipt' },
      description: { type: 'string', description: 'Payment description' },
      metadata: {
        type: 'object',
        description: 'Key-value metadata to attach to the PaymentIntent',
      },
    },
    required: ['amount', 'currency', 'customerEmail'],
  },
  outputSchema: {
    properties: {
      paymentIntentId: { type: 'string', description: 'Stripe PaymentIntent ID' },
      clientSecret: {
        type: 'string',
        description: 'Client secret for completing payment on the frontend',
      },
      status: { type: 'string', description: 'PaymentIntent status' },
    },
  },
  async execute(input: unknown) {
    const { amount, currency, customerEmail, description, metadata } = input as {
      amount: number
      currency: string
      customerEmail: string
      description?: string
      metadata?: Record<string, string>
    }

    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) throw new Error('STRIPE_SECRET_KEY not configured')

    // Stripe uses form-encoded requests
    const params = new URLSearchParams({
      amount: String(Math.round(amount * 100)), // Convert to smallest currency unit
      currency: currency.toLowerCase(),
      receipt_email: customerEmail,
    })

    if (description) params.append('description', description)

    if (metadata) {
      for (const [key, value] of Object.entries(metadata)) {
        params.append(`metadata[${key}]`, String(value))
      }
    }

    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    })

    if (!response.ok) {
      const err = (await response.json()) as { error: { message: string; code?: string } }
      throw new Error(`Stripe API error: ${err.error.message}`)
    }

    const result = (await response.json()) as {
      id: string
      client_secret: string
      status: string
    }

    return {
      paymentIntentId: result.id,
      clientSecret: result.client_secret,
      status: result.status,
    }
  },
}

export const stripeTools = [stripeTool]
