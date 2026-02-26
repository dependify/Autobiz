import type { DependifyTool } from '@dependify/orchestrator'

export const emailResendTool: DependifyTool = {
  id: 'tool.email.resend',
  name: 'Send Email via Resend',
  description: 'Send transactional or marketing emails via Resend. Supports HTML and plain text. Free tier: 3,000 emails/month.',
  category: 'communication',
  costProfile: 'free',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      to: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }], description: 'Recipient email(s)' },
      subject: { type: 'string' },
      html: { type: 'string', description: 'HTML email body' },
      text: { type: 'string', description: 'Plain text fallback' },
      from: { type: 'string', description: 'Sender email (defaults to configured from address)' },
    },
    required: ['to', 'subject', 'html'],
  },
  outputSchema: {
    properties: {
      id: { type: 'string', description: 'Resend message ID' },
      success: { type: 'boolean' },
    },
  },
  async execute(input: unknown) {
    const { to, subject, html, text, from } = input as {
      to: string | string[]
      subject: string
      html: string
      text?: string
      from?: string
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) throw new Error('RESEND_API_KEY not configured')

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: from ?? process.env.EMAIL_FROM ?? 'noreply@dependify.app',
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Resend API error: ${err}`)
    }

    const result = await response.json() as { id: string }
    return { id: result.id, success: true }
  },
}

export const smsTwilioTool: DependifyTool = {
  id: 'tool.sms.twilio',
  name: 'Send SMS via Twilio',
  description: 'Send SMS messages via Twilio for US, UK, AU, NZ, and CA markets.',
  category: 'communication',
  costProfile: 'metered',
  marketSupport: ['US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      to: { type: 'string', description: 'Recipient phone number in E.164 format' },
      body: { type: 'string', description: 'SMS body text (max 160 chars per segment)' },
    },
    required: ['to', 'body'],
  },
  outputSchema: {
    properties: {
      sid: { type: 'string' },
      status: { type: 'string' },
    },
  },
  async execute(input: unknown) {
    const { to, body } = input as { to: string; body: string }

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('Twilio credentials not configured')
    }

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: fromNumber, Body: body }),
      }
    )

    if (!response.ok) {
      const err = await response.json() as { message: string }
      throw new Error(`Twilio error: ${err.message}`)
    }

    const result = await response.json() as { sid: string; status: string }
    return { sid: result.sid, status: result.status }
  },
}

export const smsAfricasTalkingTool: DependifyTool = {
  id: 'tool.sms.africas_talking',
  name: "Send SMS via Africa's Talking",
  description: "Send SMS messages via Africa's Talking for Nigerian market. Supports bulk messaging.",
  category: 'communication',
  costProfile: 'metered',
  marketSupport: ['NG'],
  inputSchema: {
    properties: {
      to: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
      message: { type: 'string' },
      senderId: { type: 'string', description: 'Sender ID (optional, uses default if not set)' },
    },
    required: ['to', 'message'],
  },
  outputSchema: {
    properties: {
      messageId: { type: 'string' },
      status: { type: 'string' },
      cost: { type: 'string' },
    },
  },
  async execute(input: unknown) {
    const { to, message, senderId } = input as {
      to: string | string[]
      message: string
      senderId?: string
    }

    const apiKey = process.env.AFRICAS_TALKING_API_KEY
    const username = process.env.AFRICAS_TALKING_USERNAME ?? 'sandbox'

    if (!apiKey) throw new Error("Africa's Talking API key not configured")

    const recipients = Array.isArray(to) ? to.join(',') : to

    const response = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        username,
        to: recipients,
        message,
        ...(senderId ? { from: senderId } : {}),
      }),
    })

    if (!response.ok) {
      throw new Error(`Africa's Talking API error: ${response.status}`)
    }

    const result = await response.json() as { SMSMessageData: { Recipients: Array<{ messageId: string; status: string; cost: string }> } }
    const recipient = result.SMSMessageData.Recipients[0]
    return {
      messageId: recipient?.messageId ?? '',
      status: recipient?.status ?? '',
      cost: recipient?.cost ?? '',
    }
  },
}

export const communicationTools = [emailResendTool, smsTwilioTool, smsAfricasTalkingTool]
