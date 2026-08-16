import { factories } from '@strapi/strapi';
import { mergeTenantWhere, normalizeSortInput, parseOptionalPositiveInt, toPositiveInt, toText, whereByParam } from '../../../utils/tenant-scope';

const EXAM_COMPONENT_UID = 'api::exam-component.exam-component';

const EXAM_COMPONENT_POPULATE = {
  tenant: {
    select: ['id', 'name', 'code'],
  },
};

function buildExamComponentWhere(query: Record<string, unknown>) {
  const whereClauses: Array<Record<string, unknown>> = [];
  const keyword = toText(query?.search ?? query?.q);
  const componentType = toText(query?.componentType).toLowerCase();
  const examMethod = toText(query?.examMethod).toLowerCase();
  const activeFilter = toText(query?.isActive).toLowerCase();
  const minimumScore = parseOptionalPositiveInt(query?.minimumScore);
  const maximumScore = parseOptionalPositiveInt(query?.maximumScore);

  if (keyword) {
    whereClauses.push({
      $or: [
        { code: { $containsi: keyword } },
        { name: { $containsi: keyword } },
        { description: { $containsi: keyword } },
      ],
    });
  }

  if (componentType && componentType !== 'all') {
    whereClauses.push({ componentType: { $eq: componentType } });
  }

  if (examMethod && examMethod !== 'all') {
    whereClauses.push({ examMethod: { $eq: examMethod } });
  }

  if (activeFilter === 'true' || activeFilter === 'false') {
    whereClauses.push({ isActive: { $eq: activeFilter === 'true' } });
  }

  if (minimumScore !== null) {
    whereClauses.push({ minimumScore: { $gte: minimumScore } });
  }

  if (maximumScore !== null) {
    whereClauses.push({ maximumScore: { $lte: maximumScore } });
  }

  if (whereClauses.length === 0) return {};
  if (whereClauses.length === 1) return whereClauses[0];
  return { $and: whereClauses };
}

function resolveSortOrder(query: Record<string, unknown>) {
  const normalizedSort = normalizeSortInput(query?.sort);
  if (normalizedSort.length > 0) return normalizedSort;

  const sortBy = toText(query?.sortBy);
  if (sortBy) {
    return [
      { [sortBy]: toText(query?.sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc' } as Record<string, 'asc' | 'desc'>,
      { id: 'desc' },
    ];
  }

  return [
    { displayOrder: 'asc' },
    { name: 'asc' },
    { id: 'asc' },
  ] as Array<Record<string, 'asc' | 'desc'>>;
}

export async function listExamComponents(query: Record<string, unknown> = {}, tenantId: number | string) {
  const pagination = (query?.pagination && typeof query.pagination === 'object' && !Array.isArray(query.pagination))
    ? (query.pagination as Record<string, unknown>)
    : {};
  const page = toPositiveInt(query?.page ?? pagination.page, 1);
  const pageSize = Math.min(100, toPositiveInt(query?.pageSize ?? pagination.pageSize, 10));
  const where = mergeTenantWhere(buildExamComponentWhere(query), tenantId);

  const [rows, total] = await Promise.all([
    strapi.db.query(EXAM_COMPONENT_UID).findMany({
      where,
      populate: EXAM_COMPONENT_POPULATE,
      orderBy: resolveSortOrder(query),
      offset: (page - 1) * pageSize,
      limit: pageSize,
    }),
    strapi.db.query(EXAM_COMPONENT_UID).count({ where }),
  ]);

  return {
    rows,
    pagination: {
      page,
      pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getExamComponentDetail(idParam: unknown, tenantId: number | string) {
  const where = whereByParam(idParam);
  if (!where) return null;

  return strapi.db.query(EXAM_COMPONENT_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: EXAM_COMPONENT_POPULATE,
  });
}

export default factories.createCoreService(EXAM_COMPONENT_UID);