import type { DependifyTool } from '@dependify/orchestrator'

export const voiceAfricasTalkingTool: DependifyTool = {
  id: 'tool.voice.africas_talking',
  name: "Initiate Voice Call via Africa's Talking",
  description:
    "Initiate outbound voice calls via Africa's Talking for the Nigerian market. Triggers a call between two phone numbers and provides session tracking.",
  category: 'communication',
  costProfile: 'metered',
  marketSupport: ['NG'],
  inputSchema: {
    properties: {
      to: { type: 'string', description: 'Destination phone number in E.164 format' },
      from: { type: 'string', description: 'Caller ID (optional, uses default if not set)' },
      callbackUrl: { type: 'string', description: 'URL to receive call status callbacks' },
    },
    required: ['to', 'callbackUrl'],
  },
  outputSchema: {
    properties: {
      sessionId: { type: 'string', description: "Africa's Talking session ID" },
      status: { type: 'string', description: 'Initial call status' },
    },
  },
  async execute(input: unknown) {
    const { to, from, callbackUrl } = input as {
      to: string
      from?: string
      callbackUrl: string
    }

    const apiKey = process.env.AFRICAS_TALKING_API_KEY
    const username = process.env.AFRICAS_TALKING_USERNAME ?? 'sandbox'

    if (!apiKey) throw new Error('AFRICAS_TALKING_API_KEY not configured')
    if (!username) throw new Error('AFRICAS_TALKING_USERNAME not configured')

    const body: Record<string, string> = {
      username,
      to,
      callbackUrl,
    }
    if (from) body.from = from

    const response = await fetch('https://voice.africastalking.com/call', {
      method: 'POST',
      headers: {
        apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(body),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Africa's Talking Voice API error: ${response.status} - ${err}`)
    }

    const result = (await response.json()) as {
      entries?: Array<{ sessionId: string; status: string }>
      errorMessage?: string
    }

    if (result.errorMessage) {
      throw new Error(`Africa's Talking Voice error: ${result.errorMessage}`)
    }

    const entry = result.entries?.[0]
    return {
      sessionId: entry?.sessionId ?? '',
      status: entry?.status ?? 'queued',
    }
  },
}

export const voiceTwilioTool: DependifyTool = {
  id: 'tool.voice.twilio',
  name: 'Initiate Voice Call via Twilio',
  description:
    'Initiate outbound voice calls via Twilio for US, UK, AU, NZ, and CA markets. Supports TwiML instructions and callback URLs.',
  category: 'communication',
  costProfile: 'metered',
  marketSupport: ['US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      to: { type: 'string', description: 'Destination phone number in E.164 format' },
      from: {
        type: 'string',
        description: 'Caller ID — overrides TWILIO_PHONE_NUMBER if provided',
      },
      twiml: { type: 'string', description: 'TwiML instructions for the call (optional)' },
      callbackUrl: { type: 'string', description: 'URL to receive call status callbacks' },
    },
    required: ['to', 'callbackUrl'],
  },
  outputSchema: {
    properties: {
      callSid: { type: 'string', description: 'Twilio Call SID' },
      status: { type: 'string', description: 'Initial call status' },
    },
  },
  async execute(input: unknown) {
    const { to, from, twiml, callbackUrl } = input as {
      to: string
      from?: string
      twiml?: string
      callbackUrl: string
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER

    if (!accountSid) throw new Error('TWILIO_ACCOUNT_SID not configured')
    if (!authToken) throw new Error('TWILIO_AUTH_TOKEN not configured')
    if (!phoneNumber && !from)
      throw new Error('TWILIO_PHONE_NUMBER not configured and no from number provided')

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

    const params: Record<string, string> = {
      To: to,
      From: from ?? phoneNumber!,
      StatusCallback: callbackUrl,
    }

    if (twiml) {
      params.Twiml = twiml
    } else {
      params.Url = callbackUrl
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params),
      },
    )

    if (!response.ok) {
      const err = (await response.json()) as { message: string; code?: number }
      throw new Error(`Twilio Voice error ${err.code ?? response.status}: ${err.message}`)
    }

    const result = (await response.json()) as { sid: string; status: string }
    return { callSid: result.sid, status: result.status }
  },
}

export const voiceTools = [voiceAfricasTalkingTool, voiceTwilioTool]
