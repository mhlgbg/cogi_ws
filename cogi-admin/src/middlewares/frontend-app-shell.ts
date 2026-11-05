import fs from 'node:fs/promises';
import path from 'node:path';
import mime from 'mime-types';
import { injectFrontendSeoHead, resolveFrontendMetadata } from '../services/frontend-metadata';

const EXCLUDED_FIRST_SEGMENTS = new Set([
  'api',
  'admin',
  'documentation',
  'uploads',
  'storage',
  'content-manager',
  'content-type-builder',
  'email',
  'i18n',
  'users-permissions',
  'openapi',
  '_health',
]);

let cachedIndexHtml = '';
let cachedIndexMtimeMs = -1;

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizePathname(requestPath: string): string {
  const pathname = normalizeText(requestPath).split('?')[0] || '/';
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

function getFirstSegment(requestPath: string): string {
  const trimmed = normalizePathname(requestPath).replace(/^\/+|\/+$/g, '');
  if (!trimmed) return '';
  return trimmed.split('/')[0]?.toLowerCase() || '';
}

function hasFileExtension(requestPath: string): boolean {
  return Boolean(path.posix.extname(normalizePathname(requestPath)));
}

function shouldHandleHtmlRequest(ctx: any): boolean {
  if (!['GET', 'HEAD'].includes(String(ctx?.method || '').toUpperCase())) return false;

  const requestPath = normalizePathname(ctx?.request?.path || ctx?.path || '/');
  if (EXCLUDED_FIRST_SEGMENTS.has(getFirstSegment(requestPath))) return false;
  if (hasFileExtension(requestPath)) return false;

  return true;
}

function shouldAttemptStaticAsset(ctx: any): boolean {
  if (!['GET', 'HEAD'].includes(String(ctx?.method || '').toUpperCase())) return false;

  const requestPath = normalizePathname(ctx?.request?.path || ctx?.path || '/');
  if (EXCLUDED_FIRST_SEGMENTS.has(getFirstSegment(requestPath))) return false;
  return hasFileExtension(requestPath);
}

function resolveFrontendDistRoot() {
  const configured = normalizeText(process.env.FRONTEND_DIST_PATH || process.env.FRONTEND_BUILD_DIR);
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }

  return path.resolve(process.cwd(), '..', 'cogi-framework', 'dist');
}

function resolveSafeDistPath(distRoot: string, requestPath: string) {
  const normalizedPath = normalizePathname(requestPath);
  const relativePath = normalizedPath.replace(/^\/+/, '');
  const absolutePath = path.resolve(distRoot, relativePath);
  const normalizedRoot = `${path.resolve(distRoot)}${path.sep}`;

  if (`${absolutePath}${path.sep}`.startsWith(normalizedRoot) || absolutePath === path.resolve(distRoot, relativePath)) {
    if (absolutePath === path.resolve(distRoot) || absolutePath.startsWith(normalizedRoot)) {
      return absolutePath;
    }
  }

  return null;
}

async function fileExists(filePath: string | null) {
  if (!filePath) return false;
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

async function serveStaticAsset(ctx: any, distRoot: string) {
  const assetPath = resolveSafeDistPath(distRoot, ctx?.request?.path || ctx?.path || '/');
  if (!(await fileExists(assetPath))) return false;

  const body = await fs.readFile(String(assetPath));
  const contentType = mime.lookup(String(assetPath)) || 'application/octet-stream';
  ctx.status = 200;
  ctx.type = String(contentType);
  ctx.body = String(ctx?.method || '').toUpperCase() === 'HEAD' ? null : body;
  return true;
}

async function loadIndexHtml(distRoot: string) {
  const indexPath = path.join(distRoot, 'index.html');
  const stats = await fs.stat(indexPath);

  if (!cachedIndexHtml || cachedIndexMtimeMs !== stats.mtimeMs) {
    cachedIndexHtml = await fs.readFile(indexPath, 'utf8');
    cachedIndexMtimeMs = stats.mtimeMs;
  }

  return cachedIndexHtml;
}

export default (_config: unknown, { strapi }: { strapi: any }) => {
  return async (ctx: any, next: () => Promise<void>) => {
    const distRoot = resolveFrontendDistRoot();

    if (shouldAttemptStaticAsset(ctx) && await serveStaticAsset(ctx, distRoot)) {
      return;
    }

    if (!shouldHandleHtmlRequest(ctx)) {
      await next();
      return;
    }

    try {
      const html = await loadIndexHtml(distRoot);
      const metadata = await resolveFrontendMetadata(strapi, ctx);
      const responseHtml = injectFrontendSeoHead(html, metadata);

      ctx.status = 200;
      ctx.type = 'text/html; charset=utf-8';
      ctx.body = String(ctx?.method || '').toUpperCase() === 'HEAD' ? null : responseHtml;
    } catch (error: any) {
      strapi.log?.warn?.(`[frontend-app-shell] Failed to serve app shell: ${String(error?.message || error)}`);
      await next();
    }
  };
};