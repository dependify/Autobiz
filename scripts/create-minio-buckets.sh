#!/usr/bin/env bash
set -e

MINIO_URL="${MINIO_ENDPOINT:-localhost}:${MINIO_PORT:-9000}"
MINIO_ACCESS="${MINIO_ACCESS_KEY:-dependify}"
MINIO_SECRET="${MINIO_SECRET_KEY:-changeme_in_production}"
BUCKET="${MINIO_BUCKET_NAME:-dependify-files}"

echo "Creating MinIO buckets..."

# Install mc if not available
if ! command -v mc >/dev/null 2>&1; then
  echo "MinIO Client (mc) not found. Install from https://min.io/docs/minio/linux/reference/minio-mc.html"
  exit 1
fi

mc alias set dependify "http://${MINIO_URL}" "${MINIO_ACCESS}" "${MINIO_SECRET}" --quiet
mc mb --ignore-existing "dependify/${BUCKET}"
mc mb --ignore-existing "dependify/${BUCKET}-public"

# Set public bucket policy for public assets
mc anonymous set download "dependify/${BUCKET}-public"

echo "✓ MinIO buckets created:"
echo "  - ${BUCKET} (private)"
echo "  - ${BUCKET}-public (public download)"
