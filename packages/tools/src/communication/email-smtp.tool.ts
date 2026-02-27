import type { DependifyTool } from '@dependify/orchestrator'

export const emailNodemailerTool: DependifyTool = {
  id: 'tool.email.nodemailer',
  name: 'Send Email via SMTP (Nodemailer)',
  description:
    'Send emails using a custom SMTP server via Nodemailer. Use this when you need direct SMTP control or a self-hosted mail server rather than a third-party email API.',
  category: 'communication',
  costProfile: 'free',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      to: {
        oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
        description: 'Recipient email address(es)',
      },
      subject: { type: 'string', description: 'Email subject line' },
      html: { type: 'string', description: 'HTML email body' },
      text: { type: 'string', description: 'Plain text fallback body' },
      from: { type: 'string', description: 'Sender address — overrides SMTP_USER if provided' },
    },
    required: ['to', 'subject', 'html'],
  },
  outputSchema: {
    properties: {
      messageId: { type: 'string', description: 'SMTP message ID' },
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

    const host = process.env.SMTP_HOST
    const port = process.env.SMTP_PORT
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS

    if (!host) throw new Error('SMTP_HOST not configured')
    if (!user) throw new Error('SMTP_USER not configured')
    if (!pass) throw new Error('SMTP_PASS not configured')

    // Dynamic import — requires nodemailer to be installed
    let nodemailer: typeof import('nodemailer')
    try {
      nodemailer = await import('nodemailer')
    } catch {
      throw new Error(
        'nodemailer is not installed. Run: pnpm add nodemailer && pnpm add -D @types/nodemailer',
      )
    }

    const transporter = nodemailer.createTransport({
      host,
      port: port ? parseInt(port, 10) : 587,
      secure: port === '465',
      auth: { user, pass },
    })

    const mailOptions = {
      from: from ?? user,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
      text,
    }

    const info = await transporter.sendMail(mailOptions)

    return {
      messageId: info.messageId ?? '',
      success: true,
    }
  },
}

export const emailSmtpTools = [emailNodemailerTool]
