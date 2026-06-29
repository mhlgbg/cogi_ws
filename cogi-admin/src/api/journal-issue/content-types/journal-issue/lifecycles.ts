import { errors } from '@strapi/utils';
import { extractRelationRef, hasOwn, toText, whereByParam } from '../../../../utils/tenant-scope';

const JOURNAL_ISSUE_UID = 'api::journal-issue.journal-issue';
const JOURNAL_CATEGORY_UID = 'api::journal-category.journal-category';

type GenericRecord = Record<string, unknown>;

function getRequestContextTenantId(): number | string | null {
  const requestContext = strapi.requestContext?.get?.();
  const tenantId = requestContext?.state?.tenantId ?? requestContext?.state?.tenant?.id;
  if (tenantId === null || tenantId === undefined || tenantId === '') return null;
  return tenantId;
}

function getRequestContextJournalIssueRef(): string | number | null {
  const requestContext = strapi.requestContext?.get?.();
  const rawId = requestContext?.params?.id;
  if (rawId === null || rawId === undefined || rawId === '') return null;
  return rawId;
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

function slugify(value: unknown): string {
  const normalized = toText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized;
}

async function loadExistingIssue(where: unknown) {
  const normalizedWhere = typeof where === 'object' && where !== null
    ? Object.fromEntries(
      Object.entries(where as Record<string, unknown>).filter(
        ([key, value]) => !(key === 'locale' && (value === '' || value === null)),
      ),
    )
    : where;

  if (!normalizedWhere) return null;

  return strapi.db.query(JOURNAL_ISSUE_UID).findOne({
    where: normalizedWhere,
    populate: {
      tenant: { select: ['id', 'documentId'] },
    },
    select: ['id', 'documentId', 'title', 'slug', 'issueNumber', 'volume', 'year', 'publicAt'],
  });
}

async function resolveCurrentIssue(where: unknown) {
  const existingByWhere = await loadExistingIssue(where);
  if (existingByWhere) return existingByWhere;

  const requestIssueRef = getRequestContextJournalIssueRef();
  if (!requestIssueRef) return null;

  return loadExistingIssue(whereByParam(requestIssueRef));
}

async function findIssueByTenantAndSlug(tenantRef: string | number, slug: string) {
  return strapi.db.query(JOURNAL_ISSUE_UID).findMany({
    where: {
      tenant: { id: { $eq: tenantRef } },
      slug: { $eq: slug },
    },
    select: ['id', 'documentId', 'slug'],
  });
}

async function loadJournalCategory(ref: unknown) {
  const relationRef = extractRelationRef(ref);
  if (!relationRef) return null;

  const where = whereByParam(relationRef);
  if (!where) return null;

  return strapi.db.query(JOURNAL_CATEGORY_UID).findOne({
    where,
    populate: {
      tenant: { select: ['id', 'documentId'] },
    },
    select: ['id', 'documentId', 'title', 'slug'],
  });
}

async function ensureJournalIssueValid(params: { data?: GenericRecord; where?: unknown }) {
  const data = (params.data || {}) as GenericRecord;
  const existing = await resolveCurrentIssue(params.where);
  const requestTenantId = getRequestContextTenantId();
  const requestIssueRef = getRequestContextJournalIssueRef();

  if ((data.tenant === null || data.tenant === undefined || data.tenant === '') && requestTenantId) {
    data.tenant = requestTenantId;
  }

  const tenantRef = extractRelationRef(data.tenant)
    || extractEntryRelationRef(existing?.tenant)
    || requestTenantId;
  const title = hasOwn(data, 'title') ? toText(data.title) : toText(existing?.title);
  const issueNumber = hasOwn(data, 'issueNumber') ? toText(data.issueNumber) : toText(existing?.issueNumber);
  const volume = hasOwn(data, 'volume') ? toText(data.volume) : toText(existing?.volume);
  const yearRaw = hasOwn(data, 'year') ? data.year : existing?.year;
  const slug = hasOwn(data, 'slug') ? toText(data.slug) : (toText(existing?.slug) || slugify(title));

  if (!tenantRef) {
    throw new errors.ApplicationError('tenant is required');
  }

  if (!title) {
    throw new errors.ApplicationError('title is required');
  }

  if (!issueNumber) {
    throw new errors.ApplicationError('issueNumber is required');
  }

  const year = Number(yearRaw);
  if (!Number.isInteger(year)) {
    throw new errors.ApplicationError('year is required');
  }

  if (!slug) {
    throw new errors.ApplicationError('slug is required');
  }

  const siblings = await findIssueByTenantAndSlug(tenantRef, slug);
  const ignoreId = existing?.id ? String(existing.id) : null;
  const ignoreDocumentId = toText(existing?.documentId) || toText(requestIssueRef) || null;
  const duplicate = (siblings || []).find((item: any) => {
    if (ignoreId && String(item?.id) === ignoreId) return false;
    if (ignoreDocumentId && String(item?.documentId || '') === ignoreDocumentId) return false;
    return true;
  });
  if (duplicate) {
    throw new errors.ApplicationError('tenant + slug must be unique');
  }

  const journalCategoryRef = extractRelationRef(data.journalCategory);
  if (journalCategoryRef) {
    const journalCategory = await loadJournalCategory(journalCategoryRef);
    if (!journalCategory) {
      throw new errors.ApplicationError('journalCategory not found');
    }

    const journalCategoryTenantRef = extractEntryRelationRef(journalCategory?.tenant);
    if (!journalCategoryTenantRef) {
      throw new errors.ApplicationError('journalCategory tenant is required');
    }

    if (String(journalCategoryTenantRef) !== String(tenantRef)) {
      throw new errors.ApplicationError('journalCategory tenant must match journalIssue tenant');
    }
  }

  data.tenant = tenantRef;
  data.title = title;
  data.slug = slug;
  data.issueNumber = issueNumber;
  data.volume = volume || null;
  data.year = year;
}

export default {
  async beforeCreate(event: any) {
    await ensureJournalIssueValid({
      data: event.params?.data,
    });
  },

  async beforeUpdate(event: any) {
    await ensureJournalIssueValid({
      data: event.params?.data,
      where: event.params?.where,
    });
  },
};