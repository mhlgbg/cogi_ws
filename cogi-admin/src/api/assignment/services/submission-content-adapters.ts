import { toText } from '../../../utils/tenant-scope';
import { sanitizeQuickMessageHtml } from '../../quick-message/services/quick-message-html';

const BLOCKLY_DEMO_ORIGIN = 'https://blockly-demo.appspot.com';
const BLOCKLY_DEMO_HOST = 'blockly-demo.appspot.com';
const BLOCKLY_DEMO_PATH = '/static/demos/code/index.html';
const BLOCKLY_STORAGE_PATH = '/storage';
const BLOCKLY_KEY_PATTERN = /^[A-Za-z0-9_-]{3,128}$/;
const BLOCKLY_XML_MAX_LENGTH = 12000;

type Logger = {
  info?: (...args: any[]) => void;
  warn?: (...args: any[]) => void;
  error?: (...args: any[]) => void;
};

export type SubmissionSnapshotBuildOptions = {
  logger?: Logger;
  context?: {
    assignmentId?: number;
    taskId?: number;
    learnerId?: number;
    submissionId?: number;
  };
};

class SubmissionExtractionError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function compactTextForAi(value: unknown) {
  const sanitized = sanitizeQuickMessageHtml(toText(value));
  return toText(sanitized)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeBlocklyXmlForPrompt(xmlText: string) {
  const normalized = toText(xmlText).trim();
  if (!normalized) return '';
  if (normalized.length <= BLOCKLY_XML_MAX_LENGTH) return normalized;
  return `${normalized.slice(0, BLOCKLY_XML_MAX_LENGTH)}\n... [đã lược bớt ${normalized.length - BLOCKLY_XML_MAX_LENGTH} ký tự XML]`;
}

function summarizeBlocklyBlocks(xmlText: string) {
  const counters = new Map<string, number>();
  const matcher = /<block\b[^>]*\btype="([^"]+)"/g;
  let match = matcher.exec(xmlText);
  while (match) {
    const type = toText(match[1]) || 'unknown';
    counters.set(type, (counters.get(type) || 0) + 1);
    match = matcher.exec(xmlText);
  }
  const sorted = Array.from(counters.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    totalBlocks: sorted.reduce((sum, item) => sum + item[1], 0),
    byType: sorted,
  };
}

function parseBlocklyDemoUrl(urlText: string) {
  let parsed: URL;
  try {
    parsed = new URL(urlText);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return null;
  if (parsed.hostname.toLowerCase() !== BLOCKLY_DEMO_HOST) return null;
  if (parsed.pathname !== BLOCKLY_DEMO_PATH) return null;
  const rawKey = decodeURIComponent(toText(parsed.hash).replace(/^#/, '').trim());
  return {
    key: rawKey,
    normalizedUrl: `${parsed.origin}${parsed.pathname}${parsed.hash || ''}`,
  };
}

async function fetchBlocklyProgramXml(key: string) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 10000) : null;
  try {
    const response = await fetch(`${BLOCKLY_DEMO_ORIGIN}${BLOCKLY_STORAGE_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `key=${encodeURIComponent(key)}`,
      signal: controller?.signal,
    });
    if (!response.ok) {
      throw new SubmissionExtractionError(
        response.status >= 500 ? 503 : 422,
        'blockly_http_error',
        `Blockly Demo trả về lỗi HTTP ${response.status} khi lấy nội dung chương trình.`,
      );
    }
    const bodyText = toText(await response.text()).trim();
    if (!bodyText) {
      throw new SubmissionExtractionError(
        422,
        'blockly_not_found',
        'Không tìm thấy chương trình Blockly từ đường link đã nộp (key không tồn tại hoặc đã hết hiệu lực).',
      );
    }
    const xml = bodyText.replace(/^\{\[\(\< UNTRUSTED CONTENT \>\)\]\}\n/, '').trim();
    if (!xml) {
      throw new SubmissionExtractionError(422, 'blockly_empty', 'Blockly Demo trả về dữ liệu trống, không đủ để chấm bài.');
    }
    if (!xml.toLowerCase().startsWith('<xml')) {
      throw new SubmissionExtractionError(422, 'blockly_invalid_xml', 'Dữ liệu Blockly trả về không phải XML chương trình hợp lệ.');
    }
    return xml;
  } catch (error: any) {
    if (error instanceof SubmissionExtractionError) throw error;
    if (error?.name === 'AbortError') {
      throw new SubmissionExtractionError(503, 'blockly_timeout', 'Hết thời gian truy xuất chương trình Blockly. Vui lòng thử lại.');
    }
    throw new SubmissionExtractionError(503, 'blockly_unreachable', 'Không thể kết nối dịch vụ Blockly để lấy nội dung chương trình.');
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function extractBlocklyDemoSubmission(urlText: string) {
  const parsed = parseBlocklyDemoUrl(urlText);
  if (!parsed) return null;
  const key = toText(parsed.key).trim();
  if (!key) {
    throw new SubmissionExtractionError(422, 'blockly_missing_key', 'Link Blockly thiếu mã định danh sau dấu # nên không thể truy xuất bài làm.');
  }
  if (!BLOCKLY_KEY_PATTERN.test(key)) {
    throw new SubmissionExtractionError(422, 'blockly_invalid_key', 'Mã định danh Blockly trong đường link không hợp lệ.');
  }
  const xml = await fetchBlocklyProgramXml(key);
  const summary = summarizeBlocklyBlocks(xml);
  if (summary.totalBlocks <= 0) {
    throw new SubmissionExtractionError(422, 'blockly_empty_program', 'Chương trình Blockly không có khối lệnh nào nên không đủ dữ liệu để chấm.');
  }
  const topTypes = summary.byType.slice(0, 12).map(([type, count]) => `${type}(${count})`).join(', ');
  return {
    adapter: 'blockly-demo',
    normalizedUrl: parsed.normalizedUrl,
    key,
    xml,
    totalBlocks: summary.totalBlocks,
    topTypes,
  };
}

export async function buildSubmissionSnapshotForAutoGrade(submission: any, options: SubmissionSnapshotBuildOptions = {}) {
  const lines: string[] = [];
  const logger = options?.logger;
  const context = options?.context || {};

  const comment = compactTextForAi(submission?.comment);
  if (comment) lines.push(`Ghi chú học sinh: ${comment}`);

  const items = Array.isArray(submission?.items) ? submission.items : [];
  let blocklyResolvedCount = 0;
  for (const item of items) {
    const type = toText(item?.type).toLowerCase();
    const caption = compactTextForAi(item?.caption);
    const contentHtml = compactTextForAi(item?.contentHtml);
    const url = toText(item?.url);
    const fileName = toText(item?.fileAsset?.originalName || item?.fileAsset?.fileName || item?.fileAsset?.url);
    if (caption) lines.push(`Tiêu đề ${type || 'nội dung'}: ${caption}`);
    if (contentHtml) lines.push(`Nội dung ${type || 'bài nộp'}: ${contentHtml}`);

    if (url) {
      const blockly = await extractBlocklyDemoSubmission(url);
      if (blockly) {
        blocklyResolvedCount += 1;
        const normalizedXml = normalizeBlocklyXmlForPrompt(blockly.xml);
        lines.push(`Link Blockly Demo: ${blockly.normalizedUrl}`);
        lines.push(`Blockly Key: ${blockly.key}`);
        lines.push(`Tổng số khối lệnh: ${blockly.totalBlocks}`);
        if (blockly.topTypes) lines.push(`Các loại khối chính: ${blockly.topTypes}`);
        lines.push(`Blockly XML:\n${normalizedXml}`);
      } else {
        lines.push(`Link: ${url}`);
      }
    }
    if (fileName) lines.push(`Tệp đính kèm: ${fileName}`);
  }

  logger?.info?.(`[assignment-workspace:blockly-adapter] ${JSON.stringify({
    assignmentId: context.assignmentId || null,
    taskId: context.taskId || null,
    learnerId: context.learnerId || null,
    submissionId: context.submissionId || null,
    itemCount: items.length,
    blocklyResolvedCount,
  })}`);

  return lines.join('\n').trim();
}

export function mapSubmissionExtractionError(error: unknown) {
  if (error instanceof SubmissionExtractionError) return error;
  const fallback = new SubmissionExtractionError(502, 'submission_extract_failed', 'Không thể phân tích nội dung bài nộp để chấm tự động.');
  return fallback;
}
