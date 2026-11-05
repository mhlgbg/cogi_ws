import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

function resolveMasterKeyMaterial(): string {
  const candidates = [
    process.env.STORAGE_MASTER_KEY,
    process.env.STRAPI_STORAGE_MASTER_KEY,
    process.env.ENCRYPTION_KEY,
    process.env.JWT_SECRET,
    process.env.APP_KEYS,
  ];

  for (const candidate of candidates) {
    const value = typeof candidate === 'string' ? candidate.trim() : '';
    if (!value) continue;

    if (Array.isArray(candidate)) {
      const first = candidate[0];
      if (typeof first === 'string' && first.trim()) {
        return first.trim();
      }
    }

    if (value.length >= 32) {
      return value;
    }
  }

  return 'cogi-storage-encryption-key-32-bytes-required';
}

export function getStorageMasterKey(): Buffer {
  const material = resolveMasterKeyMaterial();
  const hash = crypto.createHash('sha256').update(material).digest();
  return hash;
}

export function encryptSecret(secret: string): string {
  const value = (secret ?? '').trim();
  if (!value) {
    throw new Error('secret is required');
  }

  const iv = crypto.randomBytes(12);
  const key = getStorageMasterKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(encrypted: string | null | undefined): string {
  const value = typeof encrypted === 'string' ? encrypted.trim() : '';
  if (!value) {
    throw new Error('encrypted secret is required');
  }

  const [ivHex, tagHex, encryptedHex] = value.split(':');
  if (!ivHex || !tagHex || !encryptedHex) {
    throw new Error('invalid encrypted secret format');
  }

  const key = getStorageMasterKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}
