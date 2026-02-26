import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: true,
  },
  images: {
    remotePatterns: [
      { hostname: 'avatars.githubusercontent.com' },
      { hostname: 'lh3.googleusercontent.com' },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  },
}

export default nextConfig
