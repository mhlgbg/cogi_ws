import fs from 'node:fs/promises';
import path from 'node:path';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeObject(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, any>;
}

function resolveS3CredentialsFromAlias(alias: string) {
  const normalizedAlias = toText(alias).trim();
  if (!normalizedAlias) {
    throw new Error('S3 credentialRef is required');
  }

  const directValue = process.env[normalizedAlias];
  if (directValue) {
    try {
      const parsed = JSON.parse(directValue);
      const accessKeyId = toText(parsed?.accessKeyId || parsed?.access_key_id || parsed?.accessKey || parsed?.keyId);
      const secretAccessKey = toText(parsed?.secretAccessKey || parsed?.secret_access_key || parsed?.secretKey || parsed?.secret);
      if (accessKeyId && secretAccessKey) {
        return { accessKeyId, secretAccessKey };
      }
    } catch {
      // ignore malformed JSON and continue with env-based fallback
    }
  }

  const accessKeyId = toText(process.env[`${normalizedAlias}_ACCESS_KEY_ID`] || process.env[`${normalizedAlias}_ACCESS_KEY`] || process.env[`${normalizedAlias}_KEY`] || '').trim();
  const secretAccessKey = toText(process.env[`${normalizedAlias}_SECRET_ACCESS_KEY`] || process.env[`${normalizedAlias}_SECRET_KEY`] || process.env[`${normalizedAlias}_SECRET`] || '').trim();

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(`S3 credentialRef "${normalizedAlias}" is not configured in backend environment variables`);
  }

  return { accessKeyId, secretAccessKey };
}

function getS3ClientFromMetadata(fileMeta: Record<string, any>, override: Record<string, any> = {}) {
  const metadata = normalizeObject(fileMeta?.metadata || fileMeta?.settings || {});
  const endpoint = toText(override.endpoint || metadata.endpoint || process.env.VIETTEL_S3_ENDPOINT || '').trim();
  const region = toText(override.region || metadata.region || process.env.VIETTEL_S3_REGION || 'us-east-1').trim();
  const bucket = toText(override.bucket || metadata.bucket || process.env.VIETTEL_S3_BUCKET || '').trim();
  const forcePathStyle = Boolean((override.forcePathStyle ?? metadata.forcePathStyle ?? process.env.VIETTEL_S3_FORCE_PATH_STYLE ?? 'true') === true || String(override.forcePathStyle ?? metadata.forcePathStyle ?? process.env.VIETTEL_S3_FORCE_PATH_STYLE ?? 'true').toLowerCase() === 'true');
  const credentialRef = toText(override.credentialRef || metadata.credentialRef || process.env.VIETTEL_S3_CREDENTIAL_REF || 'VIETTEL_OBJECT_STORAGE').trim();

  if (!endpoint || !bucket || !region) {
    throw new Error('S3 object metadata is incomplete: endpoint, bucket, and region are required');
  }

  const client = new S3Client({
    endpoint,
    region,
    forcePathStyle,
    credentials: resolveS3CredentialsFromAlias(credentialRef),
  });

  return { client, bucket, endpoint, region, forcePathStyle, credentialRef };
}

async function streamToBuffer(stream: any) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function buildS3SignedUrl(fileMeta: any, expiresInSeconds = 300) {
  const metadata = normalizeObject(fileMeta?.metadata || {});
  const bucket = toText(metadata.bucket || fileMeta?.bucket || process.env.VIETTEL_S3_BUCKET || '').trim();
  const objectKey = toText(metadata.objectKey || fileMeta?.objectKey || fileMeta?.relativePath || '').trim();
  if (!bucket || !objectKey) {
    throw new Error('S3 file metadata is missing bucket or objectKey');
  }

  const { client, endpoint, region } = getS3ClientFromMetadata(fileMeta);
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export function resolveStorageRoot() {
  const configuredRoot = String(process.env.STORAGE_ROOT || './storage').trim() || './storage';
  return path.isAbsolute(configuredRoot)
    ? configuredRoot
    : path.resolve(process.cwd(), configuredRoot);
}

export function isPathInsideRoot(rootPath: string, absolutePath: string) {
  const relativePath = path.relative(rootPath, absolutePath);
  if (!relativePath) return true;
  return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

export function guessStoredFileContentType(filePath: string, fallbackMimeType?: unknown) {
  const normalizedFallback = toText(fallbackMimeType).toLowerCase();
  if (normalizedFallback) return normalizedFallback;

  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.pdf') return 'application/pdf';
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.gif') return 'image/gif';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.svg') return 'image/svg+xml';
  if (extension === '.txt') return 'text/plain; charset=utf-8';
  if (extension === '.mp3') return 'audio/mpeg';
  if (extension === '.wav') return 'audio/wav';
  if (extension === '.ogg') return 'audio/ogg';
  if (extension === '.m4a') return 'audio/mp4';
  return 'application/octet-stream';
}

export function resolveStoredFileAbsolutePath(relativePathValue: unknown) {
  const relativePath = toText(relativePathValue);
  if (!relativePath) throw new Error('File path missing');
  const storageRoot = resolveStorageRoot();
  const absolutePath = path.resolve(storageRoot, ...relativePath.split('/').filter(Boolean));
  if (!isPathInsideRoot(storageRoot, absolutePath)) throw new Error('Forbidden');
  return { storageRoot, relativePath, absolutePath };
}

export async function sendStoredFileResponse(ctx: any, fileMeta: any, options: { fallbackRelativePath?: unknown; fallbackMimeType?: unknown; fallbackFileName?: unknown; metadata?: unknown } = {}) {
  const provider = toText(fileMeta?.provider || normalizeObject(fileMeta?.metadata || options.metadata || {})?.provider || '').toLowerCase();

  if (provider === 's3') {
    const metadata = normalizeObject(fileMeta?.metadata || options.metadata || {});
    const bucket = toText(metadata.bucket || fileMeta?.bucket || '').trim();
    const objectKey = toText(metadata.objectKey || fileMeta?.objectKey || fileMeta?.relativePath || '').trim();
    if (!bucket || !objectKey) {
      throw new Error('S3 file metadata is incomplete');
    }

    const { client } = getS3ClientFromMetadata(fileMeta, { bucket, credentialRef: metadata.credentialRef });
    const response = await client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    }));

    const body = response.Body as any;
    const buffer = body && typeof body.transformToByteArray === 'function'
      ? Buffer.from(await body.transformToByteArray())
      : await streamToBuffer(body);

    ctx.type = guessStoredFileContentType(fileMeta?.fileName || fileMeta?.originalName || '', fileMeta?.mimeType || options.fallbackMimeType);
    ctx.set('Content-Disposition', `inline; filename="${toText(fileMeta?.fileName || fileMeta?.originalName || options.fallbackFileName || fileMeta?.id || 'file').replace(/"/g, '')}"`);
    ctx.body = buffer;
    return;
  }

  const { absolutePath } = resolveStoredFileAbsolutePath(fileMeta?.relativePath || options.fallbackRelativePath);

  const stats = await fs.stat(absolutePath);
  if (!stats.isFile()) {
    throw new Error('File not found');
  }

  ctx.type = guessStoredFileContentType(absolutePath, fileMeta?.mimeType || options.fallbackMimeType);
  ctx.set('Content-Disposition', `inline; filename="${toText(fileMeta?.fileName || fileMeta?.originalName || options.fallbackFileName || fileMeta?.id || 'file').replace(/"/g, '')}"`);
  ctx.body = await fs.readFile(absolutePath);
}