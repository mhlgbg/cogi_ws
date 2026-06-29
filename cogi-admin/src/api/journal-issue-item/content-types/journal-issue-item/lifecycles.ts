import { errors } from '@strapi/utils';
import { extractRelationRef, hasOwn, toText } from '../../../../utils/tenant-scope';

const JOURNAL_ISSUE_ITEM_UID = 'api::journal-issue-item.journal-issue-item';
const JOURNAL_ISSUE_UID = 'api::journal-issue.journal-issue';
const ARTICLE_UID = 'api::article.article';

type GenericRecord = Record<string, unknown>;

function getRequestContextTenantId(): number | string | null {
  const requestContext = strapi.requestContext?.get?.();
  const tenantId = requestContext?.state?.tenantId ?? requestContext?.state?.tenant?.id;
  if (tenantId === null || tenantId === undefined || tenantId === '') return null;
  return tenantId;
}

function extractEntryRelationRef(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value !== 'object') return null;

  const relation = value as { id?: number | string; documentId?: string };
  if (relation.id !== undefined) return relation.id;
  if (relation.documentId) return relation.documentId;
  return null;
}

async function loadExistingItem(where: unknown) {
  const normalizedWhere = typeof where === 'object' && where !== null
    ? Object.fromEntries(
      Object.entries(where as Record<string, unknown>).filter(
        ([key, value]) => !(key === 'locale' && (value === '' || value === null)),
      ),
    )
    : where;

  if (!normalizedWhere) return null;

  return strapi.db.query(JOURNAL_ISSUE_ITEM_UID).findOne({
    where: normalizedWhere,
    populate: {
      tenant: { select: ['id', 'documentId'] },
      journalIssue: { populate: { tenant: { select: ['id', 'documentId'] } } },
      article: { populate: { tenant: { select: ['id', 'documentId'] } } },
    },
    select: ['id', 'orderNo', 'articleTitle'],
  });
}

async function loadJournalIssue(ref: unknown) {
  const relationRef = extractRelationRef(ref);
  if (!relationRef) return null;

  return strapi.db.query(JOURNAL_ISSUE_UID).findOne({
    where: typeof relationRef === 'number' ? { id: relationRef } : { documentId: relationRef },
    populate: {
      tenant: { select: ['id', 'documentId'] },
    },
    select: ['id', 'documentId'],
  });
}

async function loadArticle(ref: unknown) {
  const relationRef = extractRelationRef(ref);
  if (!relationRef) return null;

  return strapi.db.query(ARTICLE_UID).findOne({
    where: typeof relationRef === 'number' ? { id: relationRef } : { documentId: relationRef },
    populate: {
      tenant: { select: ['id', 'documentId'] },
    },
    select: ['id', 'documentId', 'title'],
  });
}

async function ensureJournalIssueItemValid(params: { data?: GenericRecord; where?: unknown }) {
  const data = (params.data || {}) as GenericRecord;
  const existing = await loadExistingItem(params.where);
  const requestTenantId = getRequestContextTenantId();

  if ((data.tenant === null || data.tenant === undefined || data.tenant === '') && requestTenantId) {
    data.tenant = requestTenantId;
  }

  const journalIssueRef = extractRelationRef(data.journalIssue) || extractEntryRelationRef(existing?.journalIssue);
  if (!journalIssueRef) {
    throw new errors.ApplicationError('journalIssue is required');
  }

  const journalIssue = await loadJournalIssue(journalIssueRef);
  if (!journalIssue) {
    throw new errors.ApplicationError('journalIssue not found');
  }

  const journalIssueTenantRef = extractEntryRelationRef(journalIssue?.tenant);
  const tenantRef = extractRelationRef(data.tenant)
    || extractEntryRelationRef(existing?.tenant)
    || journalIssueTenantRef
    || requestTenantId;

  if (!tenantRef) {
    throw new errors.ApplicationError('tenant is required');
  }

  if (!journalIssueTenantRef) {
    throw new errors.ApplicationError('journalIssue tenant is required');
  }

  if (String(journalIssueTenantRef) !== String(tenantRef)) {
    throw new errors.ApplicationError('journalIssueItem tenant must match journalIssue tenant');
  }

  const orderNoRaw = hasOwn(data, 'orderNo') ? data.orderNo : existing?.orderNo;
  const orderNo = Number(orderNoRaw);
  if (!Number.isInteger(orderNo)) {
    throw new errors.ApplicationError('orderNo is required');
  }

  const articleTitle = hasOwn(data, 'articleTitle') ? toText(data.articleTitle) : toText(existing?.articleTitle);
  if (!articleTitle) {
    throw new errors.ApplicationError('articleTitle is required');
  }

  const articleRef = extractRelationRef(data.article) || extractEntryRelationRef(existing?.article);
  if (articleRef) {
    const article = await loadArticle(articleRef);
    if (!article) {
      throw new errors.ApplicationError('article not found');
    }

    const articleTenantRef = extractEntryRelationRef(article?.tenant);
    if (!articleTenantRef) {
      throw new errors.ApplicationError('article tenant is required');
    }

    if (String(articleTenantRef) !== String(tenantRef)) {
      throw new errors.ApplicationError('article tenant must match journalIssueItem tenant');
    }
  }

  data.tenant = tenantRef;
  data.orderNo = orderNo;
  data.articleTitle = articleTitle;
}

export default {
  async beforeCreate(event: any) {
    await ensureJournalIssueItemValid({
      data: event.params?.data,
    });
  },

  async beforeUpdate(event: any) {
    await ensureJournalIssueItemValid({
      data: event.params?.data,
      where: event.params?.where,
    });
  },
};