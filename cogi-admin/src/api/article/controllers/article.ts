import { factories } from '@strapi/strapi';
import {
	assertEntityTenantMatch,
	findEntityByRef,
	mergeTenantWhere,
	normalizePopulateInput,
	normalizeSortInput,
	resolveCurrentTenantId,
	toPositiveInt,
	whereByParam,
} from '../../../utils/tenant-scope';

const ARTICLE_UID = 'api::article.article';
const CATEGORY_UID = 'api::category.category';
const AUTHOR_UID = 'api::author.author';

type GenericRecord = Record<string, unknown>;

function toText(value: unknown): string {
	if (value === null || value === undefined) return '';
	return String(value).trim();
}

function resolveReadStatus(rawStatus: unknown): 'draft' | 'published' {
	return toText(rawStatus).toLowerCase() === 'draft' ? 'draft' : 'published';
}

function resolveWriteStatus(rawStatus: unknown): 'draft' | 'published' {
	return toText(rawStatus).toLowerCase() === 'published' ? 'published' : 'draft';
}

function resolveRequestData(ctx: any): GenericRecord {
	const body = (ctx.request.body ??= {});
	if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
		body.data = {};
	}

	return body.data as GenericRecord;
}

async function resolveExistingArticle(ctx: any, tenantId: number | string) {
	return strapi.db.query(ARTICLE_UID).findOne({
		where: mergeTenantWhere(whereByParam(ctx.params?.id), tenantId),
		select: ['id', 'documentId'],
	});
}

async function validateCategoryTenant(data: GenericRecord, tenantId: number | string, ctx: any) {
	if (!Object.prototype.hasOwnProperty.call(data, 'category')) return;
	if (data.category === null || data.category === undefined || data.category === '') return;

	const category = await findEntityByRef(CATEGORY_UID, data.category, {
		tenant: {
			select: ['id', 'documentId'],
		},
	});

	assertEntityTenantMatch(category, tenantId, 'Selected category does not belong to current tenant', ctx);
}

async function validateAuthorTenant(data: GenericRecord, tenantId: number | string, ctx: any) {
	if (!Object.prototype.hasOwnProperty.call(data, 'author')) return;
	if (data.author === null || data.author === undefined || data.author === '') return;

	const author = await findEntityByRef(AUTHOR_UID, data.author, {
		tenant: {
			select: ['id', 'documentId'],
		},
	});

	assertEntityTenantMatch(author, tenantId, 'Selected author does not belong to current tenant', ctx);
}

function resolveArticlePopulate(ctx: any) {
	const requestedPopulate = normalizePopulateInput(ctx.query?.populate);
	const basePopulate: Record<string, unknown> = {
		author: {
			populate: ['avatar'],
		},
		category: true,
		tenant: true,
		cover: true,
		blocks: {
			on: {
				'shared.rich-text': true,
				'shared.quote': true,
				'shared.media': {
					populate: ['file'],
				},
				'shared.slider': {
					populate: ['files'],
				},
			},
		},
	};

	if (requestedPopulate === true) return basePopulate;
	if (Array.isArray(requestedPopulate) && requestedPopulate.length > 0) {
		const mergedPopulate = { ...basePopulate };
		for (const key of requestedPopulate) {
			if (!Object.prototype.hasOwnProperty.call(mergedPopulate, key)) {
				mergedPopulate[key] = true;
			}
		}

		return mergedPopulate;
	}

	return basePopulate;
}

export default factories.createCoreController(ARTICLE_UID, () => ({
	async find(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const query = (ctx.query || {}) as Record<string, unknown>;
		const page = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.page, 1);
		const pageSize = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.pageSize, 10);
		const filters = mergeTenantWhere(query.filters, tenantId);
		const sort = normalizeSortInput(query.sort);
		const populate = resolveArticlePopulate(ctx);
		const status = resolveReadStatus(query.status);

		const [rows, total] = await Promise.all([
			strapi.documents(ARTICLE_UID).findMany({
				filters: filters as any,
				sort: sort.length > 0 ? (sort as any) : undefined,
				status,
				pagination: { page, pageSize },
				populate,
			}),
			strapi.documents(ARTICLE_UID).count({
				filters: filters as any,
				status,
			}),
		]);

		return this.transformResponse(rows, {
			pagination: {
				page,
				pageSize,
				pageCount: Math.max(1, Math.ceil(total / pageSize)),
				total,
			},
		});
	},

	async findOne(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const existing = await resolveExistingArticle(ctx, tenantId);

		if (!existing?.documentId) {
			return ctx.notFound('Article not found');
		}

		const entity = await strapi.documents(ARTICLE_UID).findOne({
			documentId: existing.documentId,
			status: resolveReadStatus(ctx.query?.status),
			populate: resolveArticlePopulate(ctx) as any,
		});

		if (!entity) {
			return ctx.notFound('Article not found');
		}

		return this.transformResponse(entity);
	},

	async create(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const data = resolveRequestData(ctx);
		await validateCategoryTenant(data, tenantId, ctx);
		await validateAuthorTenant(data, tenantId, ctx);
		data.tenant = tenantId;
		delete data.publishedAt;

		const created = await strapi.documents(ARTICLE_UID).create({
			data: data as any,
			status: resolveWriteStatus(ctx.query?.status),
			populate: resolveArticlePopulate(ctx) as any,
		});

		return this.transformResponse(created);
	},

	async update(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const existing = await resolveExistingArticle(ctx, tenantId);

		if (!existing?.documentId) {
			return ctx.notFound('Article not found');
		}

		const data = resolveRequestData(ctx);
		await validateCategoryTenant(data, tenantId, ctx);
		await validateAuthorTenant(data, tenantId, ctx);
		data.tenant = tenantId;
		delete data.publishedAt;

		const updated = await strapi.documents(ARTICLE_UID).update({
			documentId: existing.documentId,
			data: data as any,
			status: resolveWriteStatus(ctx.query?.status),
			populate: resolveArticlePopulate(ctx) as any,
		});

		return this.transformResponse(updated);
	},

	async delete(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const existing = await resolveExistingArticle(ctx, tenantId);

		if (!existing?.documentId) {
			return ctx.notFound('Article not found');
		}

		await strapi.documents(ARTICLE_UID).delete({
			documentId: existing.documentId,
		});

		ctx.status = 204;
		return null;
	},
}));
