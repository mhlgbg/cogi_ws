const PLATFORM_SETTING_UID = 'api::platform-setting.platform-setting';
const PLATFORM_SETTINGS_STORE_KEY = 'platform-settings.entries';

type PlatformSettingValue = unknown;

type PlatformSettingInput = {
  value?: PlatformSettingValue;
  description?: string | null;
  group?: string | null;
  dataType?: string | null;
  status?: string | null;
};

const DEFAULT_PLATFORM_SETTINGS = [
  {
    key: 'tenantAdminRoleCode',
    value: 'TENANT_ADMIN',
    group: 'tenant',
    dataType: 'string',
    description: 'Dinh danh role dung de xac dinh nguoi quan tri chinh cua tenant. Co the nhap role code, type hoac role name trong Strapi admin.',
    status: 'active',
  },
];

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeDataType(value: unknown, fallback = 'string'): string {
  const text = toText(value);
  return text || fallback;
}

function normalizeStatus(value: unknown, fallback = 'active'): string {
  const text = toText(value);
  return text || fallback;
}

function inferDataType(value: unknown): string {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (value !== null && typeof value === 'object') return 'json';
  return 'string';
}

function toSettingPayload(input: PlatformSettingInput, fallback?: Partial<PlatformSettingInput>) {
  const nextValue = input.value !== undefined ? input.value : fallback?.value ?? null;
  const nextDataType = normalizeDataType(input.dataType ?? fallback?.dataType, inferDataType(nextValue));

  return {
    value: nextValue,
    description: toText(input.description ?? fallback?.description) || null,
    group: toText(input.group ?? fallback?.group) || null,
    dataType: nextDataType,
    status: normalizeStatus(input.status ?? fallback?.status, 'active'),
  };
}

function getPlatformSettingsStore() {
  return strapi.store({ type: 'plugin', name: 'users-permissions' });
}

async function readFallbackEntries(): Promise<Record<string, any>> {
  const store = getPlatformSettingsStore();
  const entries = (await store.get({ key: PLATFORM_SETTINGS_STORE_KEY })) || {};
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return {};
  }

  return entries as Record<string, any>;
}

async function writeFallbackEntries(entries: Record<string, any>) {
  const store = getPlatformSettingsStore();
  await store.set({ key: PLATFORM_SETTINGS_STORE_KEY, value: entries });
}

function formatFallbackPlatformSetting(key: string, entity: any) {
  return formatPlatformSetting({
    id: 0,
    key,
    value: entity?.value,
    description: entity?.description,
    group: entity?.group,
    dataType: entity?.dataType,
    status: entity?.status,
    createdAt: entity?.createdAt || null,
    updatedAt: entity?.updatedAt || null,
  });
}

export function formatPlatformSetting(entity: any) {
  return {
    id: Number(entity?.id || 0),
    key: toText(entity?.key),
    value: entity?.value,
    description: toText(entity?.description) || null,
    group: toText(entity?.group) || null,
    dataType: normalizeDataType(entity?.dataType, inferDataType(entity?.value)),
    status: normalizeStatus(entity?.status, 'active'),
    createdAt: entity?.createdAt || null,
    updatedAt: entity?.updatedAt || null,
  };
}

export async function ensureDefaultPlatformSettings() {
  const entries = await readFallbackEntries();
  let mutated = false;
  for (const setting of DEFAULT_PLATFORM_SETTINGS) {
    if (entries[setting.key]) continue;
    mutated = true;
    entries[setting.key] = {
      ...toSettingPayload(setting, setting),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  if (mutated) {
    await writeFallbackEntries(entries);
  }
}

export async function listPlatformSettings() {
  await ensureDefaultPlatformSettings();
  const entries = await readFallbackEntries();
  return Object.entries(entries)
    .map(([key, value]) => formatFallbackPlatformSetting(key, value))
    .sort((left, right) => {
      const groupCompare = toText(left.group).localeCompare(toText(right.group));
      if (groupCompare !== 0) return groupCompare;
      return toText(left.key).localeCompare(toText(right.key));
    });
}

export async function findPlatformSettingByKey(key: string) {
  await ensureDefaultPlatformSettings();

  const normalizedKey = toText(key);
  if (!normalizedKey) return null;
  const entries = await readFallbackEntries();
  const entity = entries[normalizedKey];
  return entity ? formatFallbackPlatformSetting(normalizedKey, entity) : null;
}

export async function upsertPlatformSettingByKey(key: string, input: PlatformSettingInput) {
  const normalizedKey = toText(key);
  if (!normalizedKey) {
    throw new Error('Setting key is required');
  }
  const entries = await readFallbackEntries();
  const existing = entries[normalizedKey] || {};
  const payload = toSettingPayload(input, existing);
  const timestamp = new Date().toISOString();
  entries[normalizedKey] = {
    ...payload,
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
  };
  await writeFallbackEntries(entries);
  return formatFallbackPlatformSetting(normalizedKey, entries[normalizedKey]);
}

export async function getPlatformSetting<T = unknown>(key: string, defaultValue: T): Promise<T> {
  const setting = await findPlatformSettingByKey(key);
  if (!setting) return defaultValue;

  return (setting.value === undefined ? defaultValue : setting.value) as T;
}

export async function getTenantAdminRoleCode(): Promise<string> {
  const value = await getPlatformSetting('tenantAdminRoleCode', 'TENANT_ADMIN');
  const normalized = toText(value);
  return normalized || 'TENANT_ADMIN';
}