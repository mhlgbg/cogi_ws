import fs from 'node:fs/promises';
import path from 'node:path';

const FILE_ASSET_UID = 'api::file-asset.file-asset';

function resolveRoot(configuredValue: string, fallbackPath: string) {
  const normalizedValue = String(configuredValue || '').trim() || fallbackPath;
  return path.isAbsolute(normalizedValue)
    ? normalizedValue
    : path.resolve(process.cwd(), normalizedValue);
}

function resolveUploadsRoot() {
  return resolveRoot(process.env.UPLOADS_ROOT || '', './public/uploads');
}

function resolveStorageRoot() {
  const configuredRoot = String(process.env.STORAGE_ROOT || './storage').trim() || './storage';
  return path.isAbsolute(configuredRoot)
    ? configuredRoot
    : path.resolve(process.cwd(), configuredRoot);
}

function isPathInsideRoot(rootPath: string, absolutePath: string) {
  const relativePath = path.relative(rootPath, absolutePath);
  if (!relativePath) return true;
  return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

function guessContentType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.pdf') return 'application/pdf';
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.gif') return 'image/gif';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.svg') return 'image/svg+xml';
  if (extension === '.txt') return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}

async function serveStaticFile(ctx: any, requestPath: string, routePrefix: '/uploads' | '/storage', rootPath: string) {
  if (requestPath !== routePrefix && !requestPath.startsWith(`${routePrefix}/`)) {
    return false;
  }

  const relativePath = requestPath.replace(new RegExp(`^${routePrefix}/?`), '');
  if (!relativePath || relativePath.includes('..')) {
    ctx.status = 400;
    ctx.body = 'Invalid storage path';
    return true;
  }

  const absolutePath = path.resolve(rootPath, ...relativePath.split('/'));
  if (!isPathInsideRoot(rootPath, absolutePath)) {
    ctx.status = 403;
    ctx.body = 'Forbidden';
    return true;
  }

  if (routePrefix === '/storage') {
    try {
      const fileAsset = await strapi.db.query(FILE_ASSET_UID).findOne({
        where: {
          relativePath: {
            $eq: relativePath,
          },
          status: {
            $ne: 'DELETED',
          },
        },
        select: ['id', 'isPublic'],
      })

      if (!fileAsset?.id) {
        ctx.status = 404
        return true
      }

      if (fileAsset.isPublic !== true) {
        ctx.status = 403
        ctx.body = 'Private file requires authenticated download endpoint'
        return true
      }
    } catch {
      ctx.status = 404
      return true
    }
  }

  try {
    const stats = await fs.stat(absolutePath);
    if (!stats.isFile()) {
      ctx.status = 404;
      return true;
    }

    ctx.type = guessContentType(absolutePath);
    ctx.set('Cache-Control', 'public, max-age=300');
    ctx.body = await fs.readFile(absolutePath);
    return true;
  } catch {
    ctx.status = 404;
    return true;
  }
}

export default (_config: unknown, { strapi }: { strapi: any }) => {
  const uploadsRoot = resolveUploadsRoot();
  const storageRoot = resolveStorageRoot();
  strapi?.log?.info?.(`[Uploads] Serving from: ${uploadsRoot} at /uploads`);
  strapi?.log?.info?.(`[Storage] Serving from: ${storageRoot} at /storage`);

  return async (ctx: any, next: () => Promise<void>) => {
    const requestPath = String(ctx.path || '').trim();
    if (await serveStaticFile(ctx, requestPath, '/uploads', uploadsRoot)) {
      return;
    }

    if (await serveStaticFile(ctx, requestPath, '/storage', storageRoot)) {
      return;
    }

    await next();
  };
};