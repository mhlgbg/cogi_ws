export const DEFAULT_PRIORITY_FIELDS = [
  'label',
  'name',
  'title',
  'email',
  'username',
  'code',
  'id',
  'documentId',
] as const;

const DEFAULT_FALLBACK = 'Unknown';
const DEFAULT_SEPARATOR = ' - ';

export type LabelPriorityField = string;
export type LabelInput = unknown;

export type LabelPartConfig = {
  value: LabelInput;
  priorityFields?: LabelPriorityField[];
  fallback?: string;
};

export type BuildLabelOptions = {
  separator?: string;
  fallback?: string;
  priorityFields?: LabelPriorityField[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value).trim();
  }
  return '';
}

export function pickFirstNonEmptyField(
  source: Record<string, unknown>,
  fields: readonly string[] = DEFAULT_PRIORITY_FIELDS,
): string {
  for (const fieldName of fields) {
    const candidate = normalizeValue(source[fieldName]);
    if (!isEmptyValue(candidate)) return candidate;
  }

  return '';
}

export function pickDisplayValue(
  value: LabelInput,
  priorityFields: readonly string[] = DEFAULT_PRIORITY_FIELDS,
  fallback = DEFAULT_FALLBACK,
): string {
  const normalizedScalar = normalizeValue(value);
  if (!isEmptyValue(normalizedScalar)) return normalizedScalar;

  if (isPlainObject(value)) {
    const fromPriorityFields = pickFirstNonEmptyField(value, priorityFields);
    if (!isEmptyValue(fromPriorityFields)) return fromPriorityFields;
  }

  return fallback;
}

function isLabelPartConfig(part: LabelInput | LabelPartConfig): part is LabelPartConfig {
  if (!isPlainObject(part)) return false;

  return Object.prototype.hasOwnProperty.call(part, 'value');
}

export function joinLabelParts(
  parts: string[],
  separator = DEFAULT_SEPARATOR,
  fallback = DEFAULT_FALLBACK,
): string {
  const normalizedParts = parts
    .map((part) => normalizeValue(part))
    .filter((part) => !isEmptyValue(part));

  if (normalizedParts.length === 0) return fallback;

  return normalizedParts.join(separator);
}

export function buildLabel(
  parts: Array<LabelInput | LabelPartConfig>,
  options: BuildLabelOptions = {},
): string {
  const separator = options.separator ?? DEFAULT_SEPARATOR;
  const fallback = options.fallback ?? DEFAULT_FALLBACK;
  const priorityFields = options.priorityFields ?? DEFAULT_PRIORITY_FIELDS;

  const resolvedParts = parts
    .map((part) => {
      if (isLabelPartConfig(part)) {
        return pickDisplayValue(
          part.value,
          part.priorityFields ?? priorityFields,
          part.fallback ?? '',
        );
      }

      return pickDisplayValue(part, priorityFields, '');
    })
    .filter((part) => !isEmptyValue(part));

  return joinLabelParts(resolvedParts, separator, fallback);
}

export default {
  DEFAULT_PRIORITY_FIELDS,
  isEmptyValue,
  normalizeValue,
  pickFirstNonEmptyField,
  pickDisplayValue,
  joinLabelParts,
  buildLabel,
};
