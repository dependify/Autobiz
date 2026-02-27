import type { DependifyTool } from '@dependify/orchestrator'

export const flutterwaveTool: DependifyTool = {
  id: 'tool.payment.flutterwave',
  name: 'Initialize Payment via Flutterwave',
  description:
    'Initialize a Flutterwave payment and generate a hosted payment link. Suitable for Nigerian market as an alternative or fallback to Paystack.',
  category: 'finance',
  costProfile: 'metered',
  marketSupport: ['NG'],
  inputSchema: {
    properties: {
      amount: { type: 'number', description: 'Payment amount in the major currency unit' },
      currency: { type: 'string', description: 'ISO currency code (e.g. NGN, USD)' },
      email: { type: 'string', description: 'Customer email address' },
      redirectUrl: {
        type: 'string',
        description: 'URL to redirect customer after payment completion',
      },
      metadata: { type: 'object', description: 'Additional metadata to attach to the transaction' },
    },
    required: ['amount', 'currency', 'email', 'redirectUrl'],
  },
  outputSchema: {
    properties: {
      paymentLink: { type: 'string', description: 'Hosted Flutterwave payment page URL' },
      transactionRef: { type: 'string', description: 'Unique transaction reference' },
    },
  },
  async execute(input: unknown) {
    const { amount, currency, email, redirectUrl, metadata } = input as {
      amount: number
      currency: string
      email: string
      redirectUrl: string
      metadata?: object
    }

    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY
    if (!secretKey) throw new Error('FLUTTERWAVE_SECRET_KEY not configured')

    const transactionRef = `fw-${Date.now()}`

    const body: Record<string, unknown> = {
      tx_ref: transactionRef,
      amount,
      currency,
      redirect_url: redirectUrl,
      customer: { email },
    }

    if (metadata) body.meta = metadata

    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const err = (await response.json()) as { message: string }
      throw new Error(`Flutterwave API error: ${err.message}`)
    }

    const result = (await response.json()) as {
      status: string
      message: string
      data: { link: string }
    }

    if (result.status !== 'success') {
      throw new Error(`Flutterwave error: ${result.message}`)
    }

    return {
      paymentLink: result.data.link,
      transactionRef,
    }
  },
}

export const flutterwaveTools = [flutterwaveTool]
