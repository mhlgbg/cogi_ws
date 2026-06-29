type GenericRecord = Record<string, unknown>;

type SnapshotFileMeta = {
  id: number | string | null;
  name: string;
  url: string | null;
  mime: string | null;
  fieldKey: string;
  fieldLabel: string;
};

type SnapshotEntry = {
  key: string;
  label: string;
  value: string;
};

type SnapshotTableRow = {
  key: string;
  cells: Array<{
    key: string;
    label: string;
    value: string;
  }>;
};

type SnapshotDisplayField = {
  key: string;
  label: string;
  type: string;
  value: string;
  files?: SnapshotFileMeta[];
  rows?: SnapshotTableRow[];
};

type SnapshotDisplaySection = {
  key: string;
  title: string;
  fields: SnapshotDisplayField[];
};

type SnapshotResult = {
  generatedAt: string;
  formTemplateVersion: number;
  studentSummary: SnapshotEntry[];
  parentSummary: SnapshotEntry[];
  studyScoreSummary: SnapshotEntry[];
  cambridgeBranch: SnapshotEntry | null;
  serviceNeeds: SnapshotEntry[];
  evidenceFiles: {
    images: SnapshotFileMeta[];
    pdfs: SnapshotFileMeta[];
  };
  displaySections: SnapshotDisplaySection[];
};

function isRecord(value: unknown): value is GenericRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function stripVietnamese(value: unknown): string {
  return toText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function normalizeMatchText(value: unknown): string {
  return stripVietnamese(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function hasAnyKeyword(value: unknown, keywords: string[]): boolean {
  const haystack = normalizeMatchText(value);
  return keywords.some((keyword) => haystack.includes(normalizeMatchText(keyword)));
}

function formatDateDisplay(value: unknown): string {
  const text = toText(value);
  if (!text) return '';

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;

  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = String(date.getUTCFullYear());
  return `${day}/${month}/${year}`;
}

function formatGender(value: unknown): string {
  const normalized = toText(value).toLowerCase();
  if (normalized === 'male') return 'Nam';
  if (normalized === 'female') return 'Nữ';
  if (normalized === 'other') return 'Khác';
  return toText(value);
}

function formatPrimitiveValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value.map((item) => formatPrimitiveValue(item)).filter(Boolean).join(', ');
  }
  if (isRecord(value)) {
    return toText(value.label || value.name || value.title || value.value);
  }
  return toText(value);
}

function normalizeOption(option: unknown) {
  if (isRecord(option)) {
    const value = toText(option.value ?? option.key ?? option.code ?? option.id);
    const label = toText(option.label ?? option.name ?? option.title ?? value);
    return value ? { value, label: label || value } : null;
  }

  const value = toText(option);
  return value ? { value, label: value } : null;
}

function normalizeVisibleWhen(visibleWhen: unknown) {
  if (!isRecord(visibleWhen)) return null;
  const field = toText(visibleWhen.field);
  if (!field) return null;
  return {
    field,
    equals: visibleWhen.equals,
  };
}

function normalizeTableColumn(column: unknown, index: number) {
  if (!isRecord(column)) return null;
  const key = toText(column.key);
  if (!key) return null;

  return {
    key,
    label: toText(column.label || key || `column_${index + 1}`),
    type: toText(column.type || 'text').toLowerCase(),
    options: Array.isArray(column.options) ? column.options.map(normalizeOption).filter(Boolean) : [],
  };
}

function normalizeField(field: unknown, index: number) {
  if (!isRecord(field)) return null;
  const key = toText(field.key);
  if (!key) return null;

  return {
    key,
    label: toText(field.label || field.title || key || `field_${index + 1}`),
    type: toText(field.type || 'text').toLowerCase(),
    options: Array.isArray(field.options) ? field.options.map(normalizeOption).filter(Boolean) : [],
    columns: Array.isArray(field.columns) ? field.columns.map(normalizeTableColumn).filter(Boolean) : [],
    visibleWhen: normalizeVisibleWhen(field.visibleWhen),
  };
}

function normalizeSection(section: unknown, index: number) {
  if (!isRecord(section)) return null;

  if (toText(section.type).toLowerCase() === 'table') {
    const tableField = normalizeField({
      ...section,
      label: section.label || section.title || section.key || `section_${index + 1}`,
    }, index);
    if (!tableField) return null;

    return {
      key: toText(section.key || `section_${index + 1}`),
      title: toText(section.title),
      fields: [tableField],
    };
  }

  const fields = Array.isArray(section.fields) ? section.fields.map(normalizeField).filter(Boolean) : [];
  if (fields.length === 0) return null;

  return {
    key: toText(section.key || `section_${index + 1}`),
    title: toText(section.title),
    fields,
  };
}

function extractTemplateSections(schema: unknown) {
  if (!isRecord(schema)) return [];

  if (Array.isArray(schema.sections)) {
    return schema.sections.map(normalizeSection).filter(Boolean);
  }

  if (Array.isArray(schema.fields)) {
    const fields = schema.fields.map(normalizeField).filter(Boolean);
    return fields.length > 0 ? [{ key: 'legacy_fields', title: '', fields }] : [];
  }

  return [];
}

function isFieldVisible(field: any, formData: GenericRecord) {
  if (!field?.visibleWhen?.field) return true;
  return formData?.[field.visibleWhen.field] === field.visibleWhen.equals;
}

function inferMimeFromName(name: string): string | null {
  const lowerName = toText(name).toLowerCase();
  if (lowerName.endsWith('.pdf')) return 'application/pdf';
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerName.endsWith('.gif')) return 'image/gif';
  if (lowerName.endsWith('.webp')) return 'image/webp';
  return null;
}

function inferMime(item: GenericRecord): string | null {
  const explicitType = toText(item.type).toLowerCase();
  if (explicitType) return explicitType;

  const url = toText(item.url);
  const name = toText(item.name);
  return inferMimeFromName(url || name);
}

function toFileMeta(item: unknown, fieldKey: string, fieldLabel: string): SnapshotFileMeta | null {
  if (isRecord(item)) {
    const name = toText(item.name || item.fileName || item.title) || 'Tệp đính kèm';
    const url = toText(item.url || item.path || item.href) || null;
    const mime = inferMime(item);
    const rawId = item.id;
    const id = typeof rawId === 'number' || typeof rawId === 'string' ? rawId : null;
    const hasSource = Boolean(name || url);
    if (!hasSource) return null;

    return {
      id,
      name,
      url,
      mime,
      fieldKey,
      fieldLabel,
    };
  }

  const text = toText(item);
  if (!text) return null;

  return {
    id: null,
    name: text,
    url: null,
    mime: inferMimeFromName(text),
    fieldKey,
    fieldLabel,
  };
}

function collectFileMetas(value: unknown, fieldKey: string, fieldLabel: string): SnapshotFileMeta[] {
  const items = Array.isArray(value) ? value : [value];
  return items.map((item) => toFileMeta(item, fieldKey, fieldLabel)).filter(Boolean) as SnapshotFileMeta[];
}

function mapOptionLabel(options: Array<{ value: string; label: string }>, value: unknown): string {
  const values = Array.isArray(value) ? value.map((item) => toText(item)) : [toText(value)];
  const labels = values.map((itemValue) => {
    const matched = options.find((option) => option.value === itemValue);
    return matched?.label || itemValue;
  }).filter(Boolean);
  return labels.join(', ');
}

function buildTableRows(field: any, value: unknown): SnapshotTableRow[] {
  const rows = Array.isArray(value) ? value : [];
  return rows.map((row, index) => {
    const record = isRecord(row) ? row : {};
    const rowKey = toText(record.id || record.key || record.label || index + 1) || String(index + 1);
    const cells = (field.columns || []).map((column: any) => ({
      key: column.key,
      label: column.label,
      value: buildFieldValue(column, record[column.key]),
    }));

    return {
      key: rowKey,
      cells,
    };
  });
}

function buildFieldValue(field: any, value: unknown): string {
  if (field?.type === 'date') return formatDateDisplay(value);
  if (field?.type === 'radio' || field?.type === 'select') {
    return mapOptionLabel(field.options || [], value);
  }
  if (field?.type === 'number') return toText(value);
  return formatPrimitiveValue(value);
}

function buildDisplaySections(formData: GenericRecord, schema: unknown) {
  const sections = extractTemplateSections(schema);
  if (sections.length === 0) {
    const fallbackFields = Object.entries(formData || {}).map(([key, value]) => ({
      key,
      label: key,
      type: 'text',
      value: formatPrimitiveValue(value),
    })).filter((item) => item.value);

    return fallbackFields.length > 0 ? [{ key: 'fallback', title: 'Thông tin hồ sơ', fields: fallbackFields }] : [];
  }

  return sections.map((section: any) => ({
    key: section.key,
    title: section.title || 'Thông tin hồ sơ',
    fields: (section.fields || [])
      .filter((field: any) => isFieldVisible(field, formData))
      .map((field: any) => {
        const value = formData?.[field.key];
        if (field.type === 'table') {
          const rows = buildTableRows(field, value);
          return {
            key: field.key,
            label: field.label,
            type: field.type,
            value: rows.length > 0 ? `${rows.length} dòng` : '',
            rows,
          };
        }

        if (field.type === 'file' || field.type === 'image') {
          const files = collectFileMetas(value, field.key, field.label);
          return {
            key: field.key,
            label: field.label,
            type: field.type,
            value: files.map((file) => file.name).join(', '),
            files,
          };
        }

        return {
          key: field.key,
          label: field.label,
          type: field.type,
          value: buildFieldValue(field, value),
        };
      })
      .filter((field: SnapshotDisplayField) => field.value || (field.files && field.files.length > 0) || (field.rows && field.rows.length > 0)),
  })).filter((section: SnapshotDisplaySection) => section.fields.length > 0);
}

function buildEntry(label: string, value: unknown, key: string): SnapshotEntry | null {
  const text = toText(value);
  return text ? { key, label, value: text } : null;
}

function uniqueEntries(entries: Array<SnapshotEntry | null>): SnapshotEntry[] {
  const seen = new Set<string>();
  const result: SnapshotEntry[] = [];

  entries.filter(Boolean).forEach((entry) => {
    if (!entry || seen.has(entry.key)) return;
    seen.add(entry.key);
    result.push(entry);
  });

  return result;
}

function buildFieldEntry(field: SnapshotDisplayField): SnapshotEntry | null {
  const text = toText(field.value);
  return text ? { key: field.key, label: field.label, value: text } : null;
}

function collectDisplayFields(displaySections: SnapshotDisplaySection[]) {
  return displaySections.flatMap((section) => section.fields);
}

const STUDENT_KEYWORDS = ['hoc sinh', 'thi sinh', 'student', 'lop', 'class', 'truong', 'school', 'dia chi', 'address', 'gioi tinh'];
const PARENT_KEYWORDS = ['phu huynh', 'parent', 'guardian', 'nguoi khai', 'cha', 'me'];
const STUDY_SCORE_KEYWORDS = ['diem', 'score', 'hoc luc', 'hoc tap', 'academic', 'gpa', 'xep loai', 'semester', 'hoc ky', 'lop', 'class'];
const CAMBRIDGE_KEYWORDS = ['cambridge', 'co so cambridge', 'cambridge branch', 'cambridge campus'];
const SERVICE_KEYWORDS = ['dich vu', 'service', 'nhu cau', 'nhu cầu', 'xe buyt', 'bus', 'ban tru', 'noi tru'];

function filterEntriesByKeywords(fields: SnapshotDisplayField[], keywords: string[], excludedKeys = new Set<string>()) {
  return uniqueEntries(fields
    .filter((field) => !excludedKeys.has(field.key))
    .filter((field) => hasAnyKeyword(`${field.label} ${field.key}`, keywords))
    .map((field) => buildFieldEntry(field)));
}

function splitEvidenceFiles(displaySections: SnapshotDisplaySection[]) {
  const files = displaySections.flatMap((section) => section.fields.flatMap((field) => field.files || []));
  const images: SnapshotFileMeta[] = [];
  const pdfs: SnapshotFileMeta[] = [];

  files.forEach((file) => {
    const mime = toText(file.mime).toLowerCase();
    const normalizedName = toText(file.name).toLowerCase();
    if (mime.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.gif', '.webp'].some((ext) => normalizedName.endsWith(ext))) {
      images.push(file);
      return;
    }

    if (mime === 'application/pdf' || normalizedName.endsWith('.pdf')) {
      pdfs.push(file);
    }
  });

  return { images, pdfs };
}

export function buildAdmissionReviewSnapshot(options: {
  application: any;
  campaign?: any;
  parent?: any;
}): SnapshotResult {
  const application = isRecord(options.application) ? options.application : {};
  const formData = isRecord(application.formData) ? application.formData : {};
  const campaign = options.campaign || application.campaign || null;
  const parent = options.parent || application.parent || null;
  const schema = campaign?.formTemplate?.schema ?? null;
  const displaySections = buildDisplaySections(formData, schema);
  const displayFields = collectDisplayFields(displaySections);

  const studentSummary = uniqueEntries([
    buildEntry('Họ tên học sinh', application.studentName, 'studentName'),
    buildEntry('Mã học sinh', application.studentCode, 'studentCode'),
    buildEntry('Ngày sinh', formatDateDisplay(application.dob), 'dob'),
    buildEntry('Giới tính', formatGender(application.gender), 'gender'),
    buildEntry('Trường hiện tại', application.currentSchool, 'currentSchool'),
    buildEntry('Địa chỉ', application.address, 'address'),
    ...filterEntriesByKeywords(displayFields, STUDENT_KEYWORDS, new Set(['studentName', 'studentCode', 'dob', 'gender', 'currentSchool', 'address'])),
  ]);

  const parentSummary = uniqueEntries([
    buildEntry('Họ tên phụ huynh', parent?.fullName || parent?.username, 'parent.fullName'),
    buildEntry('Email phụ huynh', parent?.email, 'parent.email'),
    buildEntry('Số điện thoại phụ huynh', parent?.phone, 'parent.phone'),
    ...filterEntriesByKeywords(displayFields, PARENT_KEYWORDS, new Set(['parent.fullName', 'parent.email', 'parent.phone'])),
  ]);

  const studyScoreSummary = filterEntriesByKeywords(displayFields, STUDY_SCORE_KEYWORDS);
  const cambridgeBranch = filterEntriesByKeywords(displayFields, CAMBRIDGE_KEYWORDS)[0] || null;
  const serviceNeeds = filterEntriesByKeywords(displayFields, SERVICE_KEYWORDS);
  const evidenceFiles = splitEvidenceFiles(displaySections);

  return {
    generatedAt: new Date().toISOString(),
    formTemplateVersion: Number(application.formTemplateVersion || campaign?.formTemplateVersion || campaign?.formTemplate?.version || 0),
    studentSummary,
    parentSummary,
    studyScoreSummary,
    cambridgeBranch,
    serviceNeeds,
    evidenceFiles,
    displaySections,
  };
}
