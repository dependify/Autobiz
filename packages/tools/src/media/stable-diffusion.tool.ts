import type { DependifyTool } from '@dependify/orchestrator'

export const stableDiffusionTool: DependifyTool = {
  id: 'tool.image.stable_diffusion',
  name: 'Generate Image via Stable Diffusion',
  description:
    'Generate images from text prompts using a self-hosted Stable Diffusion (AUTOMATIC1111 / SD WebUI) API. Returns a base64-encoded image.',
  category: 'content',
  costProfile: 'free',
  marketSupport: ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'],
  inputSchema: {
    properties: {
      prompt: { type: 'string', description: 'Positive text prompt describing the desired image' },
      negativePrompt: {
        type: 'string',
        description: 'Negative prompt — elements to exclude from the image',
      },
      width: { type: 'number', description: 'Image width in pixels (default: 512)', default: 512 },
      height: {
        type: 'number',
        description: 'Image height in pixels (default: 512)',
        default: 512,
      },
      steps: {
        type: 'number',
        description: 'Number of diffusion steps (default: 20)',
        default: 20,
      },
      seed: {
        type: 'number',
        description: 'Seed for reproducible results (-1 for random)',
        default: -1,
      },
    },
    required: ['prompt'],
  },
  outputSchema: {
    properties: {
      imageUrl: { type: 'string', description: 'Base64 data URL of the generated image' },
      seed: {
        type: 'number',
        description: 'Seed used for generation (useful for reproducibility)',
      },
    },
  },
  async execute(input: unknown) {
    const { prompt, negativePrompt, width, height, steps, seed } = input as {
      prompt: string
      negativePrompt?: string
      width?: number
      height?: number
      steps?: number
      seed?: number
    }

    const serviceUrl = process.env.STABLE_DIFFUSION_URL
    if (!serviceUrl) throw new Error('STABLE_DIFFUSION_URL not configured')

    const response = await fetch(`${serviceUrl}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        negative_prompt: negativePrompt ?? '',
        width: width ?? 512,
        height: height ?? 512,
        steps: steps ?? 20,
        seed: seed ?? -1,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Stable Diffusion API error: ${response.status} - ${err}`)
    }

    const result = (await response.json()) as {
      images?: string[]
      info?: string
      parameters?: Record<string, unknown>
    }

    if (!result.images?.length) {
      throw new Error('Stable Diffusion returned no images')
    }

    // Parse the info string to extract the seed used
    let usedSeed = seed ?? -1
    if (result.info) {
      try {
        const info = JSON.parse(result.info) as { seed?: number; all_seeds?: number[] }
        usedSeed = info.seed ?? info.all_seeds?.[0] ?? usedSeed
      } catch {
        // Info may not always be parseable
      }
    }

    const imageBase64 = result.images[0]
    const imageUrl = `data:image/png;base64,${imageBase64}`

    return { imageUrl, seed: usedSeed }
  },
}

export const stableDiffusionTools = [stableDiffusionTool]
