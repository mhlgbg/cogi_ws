const sanitizeHtml = require('sanitize-html');

const ALLOWED_TAGS = [
  'p', 'br',
  'strong', 'b', 'em', 'i', 'u', 's',
  'h1', 'h2', 'h3', 'h4',
  'ul', 'ol', 'li',
  'div', 'span',
  'blockquote', 'hr',
  'a',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'small', 'sup', 'sub',
];

const ALLOWED_ATTRIBUTES = {
  '*': ['class', 'style'],
  a: ['href', 'target', 'rel', 'title'],
  th: ['colspan', 'rowspan'],
  td: ['colspan', 'rowspan'],
} as Record<string, string[]>;

const COLOR_VALUE = /^(?:#[0-9a-f]{3,8}|(?:rgb|hsl)a?\(\s*[\d.%\s,/-]+\)|[a-z]+)$/i;
const LENGTH_VALUE = /^(?:0|(?:-?\d+(?:\.\d+)?)(?:px|r?em|%|vh|vw|vmin|vmax|pt))$/i;
const BOX_SPACING_VALUE = new RegExp(`^${LENGTH_VALUE.source}(?:\\s+${LENGTH_VALUE.source}){0,3}$`, 'i');
const BORDER_STYLE_VALUE = /^(?:none|solid|dashed|dotted|double)$/i;
const BORDER_WIDTH_VALUE = /^(?:0|thin|medium|thick|(?:\d+(?:\.\d+)?)(?:px|r?em|pt))$/i;
const BORDER_RADIUS_VALUE = new RegExp(`^${LENGTH_VALUE.source}(?:\\s+${LENGTH_VALUE.source}){0,3}$`, 'i');
const SAFE_BORDER_VALUE = new RegExp(`^${BORDER_WIDTH_VALUE.source}\\s+${BORDER_STYLE_VALUE.source}(?:\\s+${COLOR_VALUE.source})?$`, 'i');

const ALLOWED_STYLES = {
  '*': {
    color: [COLOR_VALUE],
    'background-color': [COLOR_VALUE],
    background: [COLOR_VALUE],
    padding: [BOX_SPACING_VALUE],
    'padding-top': [LENGTH_VALUE],
    'padding-right': [LENGTH_VALUE],
    'padding-bottom': [LENGTH_VALUE],
    'padding-left': [LENGTH_VALUE],
    margin: [BOX_SPACING_VALUE],
    'margin-top': [LENGTH_VALUE],
    'margin-right': [LENGTH_VALUE],
    'margin-bottom': [LENGTH_VALUE],
    'margin-left': [LENGTH_VALUE],
    'border-radius': [BORDER_RADIUS_VALUE],
    border: [SAFE_BORDER_VALUE],
    'border-top': [SAFE_BORDER_VALUE],
    'border-right': [SAFE_BORDER_VALUE],
    'border-bottom': [SAFE_BORDER_VALUE],
    'border-left': [SAFE_BORDER_VALUE],
    'border-color': [COLOR_VALUE],
    'border-top-color': [COLOR_VALUE],
    'border-right-color': [COLOR_VALUE],
    'border-bottom-color': [COLOR_VALUE],
    'border-left-color': [COLOR_VALUE],
    'border-width': [BOX_SPACING_VALUE],
    'border-top-width': [LENGTH_VALUE],
    'border-right-width': [LENGTH_VALUE],
    'border-bottom-width': [LENGTH_VALUE],
    'border-left-width': [LENGTH_VALUE],
    'border-style': [new RegExp(`^${BORDER_STYLE_VALUE.source}(?:\\s+${BORDER_STYLE_VALUE.source}){0,3}$`, 'i')],
    'font-size': [LENGTH_VALUE],
    'font-weight': [/^(?:normal|bold|bolder|lighter|[1-9]00)$/i],
    'font-style': [/^(?:normal|italic|oblique)$/i],
    'text-align': [/^(?:left|right|center|justify)$/i],
    'text-decoration': [/^(?:none|underline|line-through|overline)$/i],
    display: [/^(?:block|inline|inline-block|flex|grid|table|table-row|table-cell|none)$/i],
    width: [/^(?:auto|100%|[1-9]\d?%|0|(?:\d+(?:\.\d+)?)(?:px|r?em|vw|vh|vmin|vmax))$/i],
    'max-width': [/^(?:none|100%|[1-9]\d?%|0|(?:\d+(?:\.\d+)?)(?:px|r?em|vw|vh|vmin|vmax))$/i],
    'min-width': [/^(?:0|100%|[1-9]\d?%|(?:\d+(?:\.\d+)?)(?:px|r?em|vw|vh|vmin|vmax))$/i],
    height: [/^(?:auto|100%|[1-9]\d?%|0|(?:\d+(?:\.\d+)?)(?:px|r?em|vw|vh|vmin|vmax))$/i],
    'line-height': [/^(?:normal|0|(?:\d+(?:\.\d+)?)(?:px|r?em|%|vh|vw)?|[1-9]\d?%)$/i],
    'letter-spacing': [/^(?:normal|0|(?:-?\d+(?:\.\d+)?)(?:px|r?em|pt))$/i],
    'white-space': [/^(?:normal|nowrap|pre|pre-wrap|pre-line)$/i],
  },
} as Record<string, Record<string, RegExp[]>>;

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

export function extractQuickMessageHtmlFragment(value: unknown): string {
  const source = toText(value).trim();
  if (!source) return '';

  const withoutDoctype = source.replace(/<!DOCTYPE[^>]*>/gi, '').trim();
  const bodyMatch = withoutDoctype.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch?.[1]) {
    return bodyMatch[1].trim();
  }

  return withoutDoctype;
}

export function sanitizeQuickMessageHtml(value: unknown): string {
  const fragment = extractQuickMessageHtmlFragment(value);
  if (!fragment) return '';

  return sanitizeHtml(fragment, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedStyles: ALLOWED_STYLES,
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesAppliedToAttributes: ['href'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    parseStyleAttributes: true,
    parser: {
      lowerCaseTags: true,
    },
    transformTags: {
      a: (tagName: string, attribs: Record<string, string>) => {
        const href = toText(attribs?.href).trim();
        const title = toText(attribs?.title).trim();
        const nextAttribs: Record<string, string> = {};

        if (href) {
          nextAttribs.href = href;
          nextAttribs.target = '_blank';
          nextAttribs.rel = 'noopener noreferrer';
        }
        if (title) {
          nextAttribs.title = title;
        }

        return {
          tagName,
          attribs: nextAttribs,
        };
      },
      th: (tagName: string, attribs: Record<string, string>) => ({
        tagName,
        attribs: normalizeTableCellAttributes(attribs),
      }),
      td: (tagName: string, attribs: Record<string, string>) => ({
        tagName,
        attribs: normalizeTableCellAttributes(attribs),
      }),
    },
    exclusiveFilter(frame: { tag: string; attribs: Record<string, string> }) {
      if ((frame.tag === 'a') && !toText(frame.attribs?.href).trim()) {
        delete frame.attribs.target;
        delete frame.attribs.rel;
      }
      return false;
    },
  }).trim();
}

function normalizeTableCellAttributes(attribs: Record<string, string>) {
  const normalized: Record<string, string> = {};
  const colspan = normalizePositiveTableSpan(attribs?.colspan);
  const rowspan = normalizePositiveTableSpan(attribs?.rowspan);
  if (colspan) normalized.colspan = colspan;
  if (rowspan) normalized.rowspan = rowspan;
  return normalized;
}

function normalizePositiveTableSpan(value: unknown): string | null {
  const parsed = Number(String(value || '').trim());
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return String(parsed);
}

export const QUICK_MESSAGE_HTML_POLICY = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: ALLOWED_ATTRIBUTES,
  allowedStyles: ALLOWED_STYLES,
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
};