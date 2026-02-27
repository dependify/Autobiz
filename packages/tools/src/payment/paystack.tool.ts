import type { DependifyTool } from '@dependify/orchestrator'

export const paystackTool: DependifyTool = {
  id: 'tool.payment.paystack',
  name: 'Initialize Payment via Paystack',
  description:
    'Initialize a Paystack payment transaction for Nigerian customers. Returns an authorization URL to redirect the customer to complete payment.',
  category: 'finance',
  costProfile: 'metered',
  marketSupport: ['NG'],
  inputSchema: {
    properties: {
      email: { type: 'string', description: 'Customer email address' },
      amount: {
        type: 'number',
        description: 'Amount in the major currency unit (e.g. Naira, not kobo)',
      },
      currency: { type: 'string', description: 'ISO currency code (default: NGN)', default: 'NGN' },
      reference: {
        type: 'string',
        description: 'Unique transaction reference (auto-generated if omitted)',
      },
      callbackUrl: { type: 'string', description: 'URL to redirect customer after payment' },
      metadata: { type: 'object', description: 'Additional metadata to attach to the transaction' },
    },
    required: ['email', 'amount', 'currency'],
  },
  outputSchema: {
    properties: {
      authorizationUrl: {
        type: 'string',
        description: 'URL to redirect customer to complete payment',
      },
      accessCode: { type: 'string', description: 'Paystack access code for inline payment' },
      reference: { type: 'string', description: 'Transaction reference for verification' },
    },
  },
  async execute(input: unknown) {
    const { email, amount, currency, reference, callbackUrl, metadata } = input as {
      email: string
      amount: number
      currency: string
      reference?: string
      callbackUrl?: string
      metadata?: object
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!secretKey) throw new Error('PAYSTACK_SECRET_KEY not configured')

    const body: Record<string, unknown> = {
      email,
      amount: Math.round(amount * 100), // Convert to kobo
      currency: currency ?? 'NGN',
    }

    if (reference) body.reference = reference
    if (callbackUrl) body.callback_url = callbackUrl
    if (metadata) body.metadata = metadata

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const err = (await response.json()) as { message: string }
      throw new Error(`Paystack API error: ${err.message}`)
    }

    const result = (await response.json()) as {
      status: boolean
      message: string
      data: {
        authorization_url: string
        access_code: string
        reference: string
      }
    }

    if (!result.status) {
      throw new Error(`Paystack error: ${result.message}`)
    }

    return {
      authorizationUrl: result.data.authorization_url,
      accessCode: result.data.access_code,
      reference: result.data.reference,
    }
  },
}

export const paystackTools = [paystackTool]
