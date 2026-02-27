import type { DependifyTool } from '@dependify/orchestrator'
import crypto from 'crypto'

// ─── AWS Signature V4 helper (reused for R2) ─────────────────────────────────

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf-8').digest()
}

function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf-8').digest('hex')
}

interface SignedHeaders {
  Authorization: string
  'x-amz-date': string
  'x-amz-content-sha256': string
  host: string
  [key: string]: string
}

interface Aws4SignOptions {
  method: string
  host: string
  path: string
  region: string
  service: string
  accessKey: string
  secretKey: string
  body: string
  contentType?: string
}

function signAws4Request(opts: Aws4SignOptions): SignedHeaders {
  const now = new Date()
  const amzDate = now
    .toISOString()
    .replace(/[:-]/g, '')
    .replace(/\.\d{3}/, '')
  const dateStamp = amzDate.slice(0, 8)

  const payloadHash = sha256Hex(opts.body)

  const headersToSign: Record<string, string> = {
    host: opts.host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    ...(opts.contentType ? { 'content-type': opts.contentType } : {}),
  }

  const sortedHeaderKeys = Object.keys(headersToSign).sort()
  const canonicalHeaders = sortedHeaderKeys.map((k) => `${k}:${headersToSign[k]}\n`).join('')
  const signedHeadersList = sortedHeaderKeys.join(';')

  const canonicalRequest = [
    opts.method.toUpperCase(),
    opts.path,
    '',
    canonicalHeaders,
    signedHeadersList,
    payloadHash,
  ].join('\n')

  const credentialScope = `${dateStamp}/${opts.region}/${opts.service}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n')

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${opts.secretKey}`, dateStamp), opts.region), opts.service),
    'aws4_request',
  )
  const signature = hmac(signingKey, stringToSign).toString('hex')

  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${opts.accessKey}/${credentialScope}`,
    `SignedHeaders=${signedHeadersList}`,
    `Signature=${signature}`,
  ].join(', ')

  return {
    Authorization: authorization,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    host: opts.host,
    ...(opts.contentType ? { 'content-type': opts.contentType } : {}),
  }
}

// ─── Cloudflare R2 Tool ───────────────────────────────────────────────────────

export const cloudflareR2Tool: DependifyTool = {
  id: 'tool.storage.cloudflare_r2',
  name: 'Cloudflare R2 Object Storage',
  description:
    'Upload or retrieve objects from Cloudflare R2 storage using S3-compatible API with AWS Signature V4. R2 has zero egress fees.',
  category: 'storage',
  costProfile: 'metered',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      operation: {
        type: 'string',
        enum: ['upload', 'download'],
        description: 'Storage operation to perform',
      },
      key: { type: 'string', description: 'Object key (file path within the bucket)' },
      data: { type: 'string', description: 'Base64-encoded file content (required for upload)' },
      contentType: {
        type: 'string',
        description: 'MIME type of the content (for upload)',
        default: 'application/octet-stream',
      },
    },
    required: ['operation', 'key'],
  },
  outputSchema: {
    properties: {
      url: { type: 'string', description: 'Public URL or presigned download URL' },
      key: { type: 'string', description: 'Object key' },
    },
  },
  async execute(input: unknown) {
    const { operation, key, data, contentType } = input as {
      operation: 'upload' | 'download'
      key: string
      data?: string
      contentType?: string
    }

    const accountId = process.env.R2_ACCOUNT_ID
    const accessKey = process.env.R2_ACCESS_KEY
    const secretKey = process.env.R2_SECRET_KEY
    const bucket = process.env.R2_BUCKET

    if (!accountId) throw new Error('R2_ACCOUNT_ID not configured')
    if (!accessKey) throw new Error('R2_ACCESS_KEY not configured')
    if (!secretKey) throw new Error('R2_SECRET_KEY not configured')
    if (!bucket) throw new Error('R2_BUCKET not configured')

    const host = `${accountId}.r2.cloudflarestorage.com`
    const baseUrl = `https://${host}`
    const region = 'auto' // Cloudflare R2 uses 'auto' as region

    switch (operation) {
      case 'upload': {
        if (!data) throw new Error('data is required for upload operation')

        const fileBuffer = Buffer.from(data, 'base64')
        const bodyString = fileBuffer.toString('binary')
        const mimeType = contentType ?? 'application/octet-stream'

        const signedHeaders = signAws4Request({
          method: 'PUT',
          host,
          path: `/${bucket}/${key}`,
          region,
          service: 's3',
          accessKey,
          secretKey,
          body: bodyString,
          contentType: mimeType,
        })

        const response = await fetch(`${baseUrl}/${bucket}/${key}`, {
          method: 'PUT',
          headers: {
            ...signedHeaders,
            'Content-Type': mimeType,
            'Content-Length': String(fileBuffer.length),
          },
          body: fileBuffer,
        })

        if (!response.ok) {
          const err = await response.text()
          throw new Error(`Cloudflare R2 upload error: ${response.status} - ${err}`)
        }

        // Return the public URL (assumes bucket has public access configured)
        const publicUrl = process.env.R2_PUBLIC_URL
          ? `${process.env.R2_PUBLIC_URL}/${key}`
          : `${baseUrl}/${bucket}/${key}`

        return { url: publicUrl, key }
      }

      case 'download': {
        // Generate a presigned GET URL valid for 1 hour
        const now = new Date()
        const amzDate = now
          .toISOString()
          .replace(/[:-]/g, '')
          .replace(/\.\d{3}/, '')
        const dateStamp = amzDate.slice(0, 8)
        const expiry = 3600

        const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
        const credential = `${accessKey}/${credentialScope}`

        const queryParams = new URLSearchParams({
          'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
          'X-Amz-Credential': credential,
          'X-Amz-Date': amzDate,
          'X-Amz-Expires': String(expiry),
          'X-Amz-SignedHeaders': 'host',
        })

        const canonicalRequest = [
          'GET',
          `/${bucket}/${key}`,
          queryParams.toString(),
          `host:${host}\n`,
          'host',
          'UNSIGNED-PAYLOAD',
        ].join('\n')

        const stringToSign = [
          'AWS4-HMAC-SHA256',
          amzDate,
          credentialScope,
          sha256Hex(canonicalRequest),
        ].join('\n')

        const signingKey = hmac(
          hmac(hmac(hmac(`AWS4${secretKey}`, dateStamp), region), 's3'),
          'aws4_request',
        )
        const signature = hmac(signingKey, stringToSign).toString('hex')

        queryParams.append('X-Amz-Signature', signature)

        const presignedUrl = `${baseUrl}/${bucket}/${key}?${queryParams.toString()}`

        return { url: presignedUrl, key }
      }

      default:
        throw new Error(`Unsupported R2 operation: ${operation}`)
    }
  },
}

export const r2Tools = [cloudflareR2Tool]
