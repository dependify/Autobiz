import type { DependifyTool } from '@dependify/orchestrator'

export const whatsappBaileysTool: DependifyTool = {
  id: 'tool.whatsapp.baileys',
  name: 'Send WhatsApp Message via Baileys',
  description:
    'Send WhatsApp messages using a self-hosted Baileys (WhatsApp Web API) service. Supports text messages and media attachments across all markets.',
  category: 'communication',
  costProfile: 'free',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      to: { type: 'string', description: 'Recipient phone number in E.164 format or WhatsApp JID' },
      message: { type: 'string', description: 'Text message to send' },
      mediaUrl: {
        type: 'string',
        description: 'Optional URL of media (image, video, document) to attach',
      },
    },
    required: ['to', 'message'],
  },
  outputSchema: {
    properties: {
      messageId: { type: 'string', description: 'WhatsApp message ID' },
      status: { type: 'string', description: 'Message delivery status' },
    },
  },
  async execute(input: unknown) {
    const { to, message, mediaUrl } = input as {
      to: string
      message: string
      mediaUrl?: string
    }

    const serviceUrl = process.env.WHATSAPP_SERVICE_URL
    if (!serviceUrl) throw new Error('WHATSAPP_SERVICE_URL not configured')

    const body: Record<string, unknown> = { to, message }
    if (mediaUrl) body.mediaUrl = mediaUrl

    const response = await fetch(`${serviceUrl}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`WhatsApp Baileys service error: ${response.status} - ${err}`)
    }

    const result = (await response.json()) as { messageId?: string; id?: string; status?: string }
    return {
      messageId: result.messageId ?? result.id ?? '',
      status: result.status ?? 'sent',
    }
  },
}

export const whatsappTools = [whatsappBaileysTool]
