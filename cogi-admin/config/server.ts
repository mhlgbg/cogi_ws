import fs from 'node:fs';
import path from 'node:path';

function resolveUploadsRoot(env: any) {
  const configuredRoot = String(env('UPLOADS_ROOT', '') || '').trim();
  if (!configuredRoot) {
    return path.resolve(process.cwd(), 'public', 'uploads');
  }

  return path.isAbsolute(configuredRoot)
    ? configuredRoot
    : path.resolve(process.cwd(), configuredRoot);
}

export default ({ env }) => ({
  dirs: {
    public: (() => {
      const uploadsRoot = resolveUploadsRoot(env);
      fs.mkdirSync(uploadsRoot, { recursive: true });
      return path.dirname(uploadsRoot);
    })(),
  },
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
});
