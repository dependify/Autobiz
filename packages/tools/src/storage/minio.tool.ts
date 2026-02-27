import type { DependifyTool } from '@dependify/orchestrator'
import crypto from 'crypto'

// ─── AWS Signature V4 helper (S3-compatible) ─────────────────────────────────

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf-8').digest()
}

function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf-8').digest('hex')
}

function toBase64(input: string): string {
  return Buffer.from(input).toString('base64')
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
  extraHeaders?: Record<string, string>
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
    ...(opts.extraHeaders ?? {}),
  }

  const sortedHeaderKeys = Object.keys(headersToSign).sort()
  const canonicalHeaders = sortedHeaderKeys.map((k) => `${k}:${headersToSign[k]}\n`).join('')
  const signedHeadersList = sortedHeaderKeys.join(';')

  const canonicalRequest = [
    opts.method.toUpperCase(),
    opts.path,
    '', // query string (empty)
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

// ─── MinIO Tool ───────────────────────────────────────────────────────────────

export const minioTool: DependifyTool = {
  id: 'tool.storage.minio',
  name: 'MinIO Object Storage',
  description:
    'Perform object storage operations (upload, download, delete, list) on a self-hosted MinIO instance using S3-compatible API with AWS Signature V4.',
  category: 'storage',
  costProfile: 'free',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      operation: {
        type: 'string',
        enum: ['upload', 'download', 'delete', 'list'],
        description: 'Storage operation to perform',
      },
      bucket: { type: 'string', description: 'Bucket name' },
      key: { type: 'string', description: 'Object key (file path within the bucket)' },
      data: { type: 'string', description: 'Base64-encoded file content (required for upload)' },
      contentType: {
        type: 'string',
        description: 'MIME type of the content (for upload)',
        default: 'application/octet-stream',
      },
    },
    required: ['operation', 'bucket', 'key'],
  },
  outputSchema: {
    properties: {
      url: { type: 'string', description: 'Public or presigned URL of the object' },
      key: { type: 'string', description: 'Object key' },
      size: { type: 'number', description: 'Object size in bytes (for download info)' },
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of object keys (for list operation)',
      },
    },
  },
  async execute(input: unknown) {
    const { operation, bucket, key, data, contentType } = input as {
      operation: 'upload' | 'download' | 'delete' | 'list'
      bucket: string
      key: string
      data?: string
      contentType?: string
    }

    const endpoint = process.env.MINIO_ENDPOINT
    const accessKey = process.env.MINIO_ACCESS_KEY
    const secretKey = process.env.MINIO_SECRET_KEY

    if (!endpoint) throw new Error('MINIO_ENDPOINT not configured')
    if (!accessKey) throw new Error('MINIO_ACCESS_KEY not configured')
    if (!secretKey) throw new Error('MINIO_SECRET_KEY not configured')

    // Determine scheme — default to https, allow http for local dev
    const useHttp =
      endpoint.startsWith('localhost') ||
      endpoint.startsWith('127.') ||
      endpoint.startsWith('minio:')
    const baseUrl = endpoint.startsWith('http')
      ? endpoint
      : `${useHttp ? 'http' : 'https'}://${endpoint}`
    const urlObj = new URL(baseUrl)
    const host = urlObj.host
    const region = process.env.MINIO_REGION ?? 'us-east-1'

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
          throw new Error(`MinIO upload error: ${response.status} - ${err}`)
        }

        return {
          url: `${baseUrl}/${bucket}/${key}`,
          key,
        }
      }

      case 'download': {
        // Return a presigned GET URL valid for 1 hour
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

      case 'delete': {
        const signedHeaders = signAws4Request({
          method: 'DELETE',
          host,
          path: `/${bucket}/${key}`,
          region,
          service: 's3',
          accessKey,
          secretKey,
          body: '',
        })

        const response = await fetch(`${baseUrl}/${bucket}/${key}`, {
          method: 'DELETE',
          headers: signedHeaders,
        })

        if (!response.ok && response.status !== 204) {
          const err = await response.text()
          throw new Error(`MinIO delete error: ${response.status} - ${err}`)
        }

        return { key }
      }

      case 'list': {
        const listPath = `/${bucket}?list-type=2&prefix=${encodeURIComponent(key === '/' ? '' : key)}`

        const signedHeaders = signAws4Request({
          method: 'GET',
          host,
          path: `/${bucket}`,
          region,
          service: 's3',
          accessKey,
          secretKey,
          body: '',
        })

        const response = await fetch(`${baseUrl}${listPath}`, {
          method: 'GET',
          headers: signedHeaders,
        })

        if (!response.ok) {
          const err = await response.text()
          throw new Error(`MinIO list error: ${response.status} - ${err}`)
        }

        const xml = await response.text()
        // Parse keys from XML using regex (avoid xml parser dependency)
        const keyMatches = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)]
        const files = keyMatches.map((m) => m[1])

        return { files }
      }

      default:
        throw new Error(`Unsupported MinIO operation: ${operation}`)
    }
  },
}

export const minioTools = [minioTool]
