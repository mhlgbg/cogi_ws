import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { extractRelationRef, hasOwn, mergeTenantWhere, normalizeSortInput, toPositiveInt, toText, whereByParam } from '../../../utils/tenant-scope';

const PAYMENT_PROFILE_UID = 'api::payment-profile.payment-profile' as any;

type HttpErrorDetails = Record<string, unknown> | Array<Record<string, unknown>> | null;
type GenericRecord = Record<string, unknown>;

export class PaymentProfileError extends Error {
	status: number;
	code?: string | null;
	details?: HttpErrorDetails;

	constructor(status: number, message: string, code?: string | null, details?: HttpErrorDetails) {
		super(message);
		this.status = status;
		this.code = code || null;
		this.details = typeof details === 'undefined' ? null : details;
	}
}

function httpError(status: number, message: string, code?: string, details?: HttpErrorDetails): never {
	throw new PaymentProfileError(status, message, code, details);
}

function ensureNoUnknownFields(payload: GenericRecord, allowedFields: string[]) {
	const allowed = new Set(allowedFields);
	const unknown = Object.keys(payload || {}).filter((key) => !allowed.has(key));
	if (unknown.length > 0) {
		httpError(400, 'payload contains unknown fields', 'UNKNOWN_FIELDS', { fields: unknown });
	}
}

function normalizeText(value: unknown): string {
	return toText(value);
}

function normalizeOptionalText(value: unknown, maxLength?: number): string | null {
	const text = normalizeText(value);
	if (!text) return null;
	if (maxLength && text.length > maxLength) {
		httpError(400, `Text exceeds max length ${maxLength}`, 'INVALID_TEXT_LENGTH');
	}
	return text;
}

function normalizeRequiredText(value: unknown, fieldName: string, maxLength?: number): string {
	const text = normalizeText(value);
	if (!text) {
		httpError(400, `${fieldName} is required`, fieldName === 'code' ? 'INVALID_LEARNER_CODE' : 'INVALID_REQUEST_BODY');
	}
	if (maxLength && text.length > maxLength) {
		httpError(400, `${fieldName} max length is ${maxLength}`, 'INVALID_REQUEST_BODY');
	}
	return text;
}

function normalizePaymentMethod(value: unknown) {
	const normalized = normalizeText(value).toLowerCase();
	if (!normalized) return 'bank_transfer';
	if (!['bank_transfer', 'cash', 'other'].includes(normalized)) {
		httpError(400, 'paymentMethod is invalid', 'PAYMENT_PROFILE_INVALID_METHOD');
	}
	return normalized;
}

function normalizeCurrency(value: unknown) {
	return normalizeRequiredText(value || 'VND', 'currency', 10).toUpperCase();
}

function normalizeCode(value: unknown) {
	return normalizeRequiredText(value, 'code', 100).toUpperCase();
}

function normalizeEmail(value: unknown) {
	const text = normalizeText(value).toLowerCase();
	if (!text) return null;
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
		httpError(400, 'supportEmail is invalid', 'INVALID_EMAIL');
	}
	return text;
}

function normalizeSortOrder(value: unknown) {
	const parsed = Number(value ?? 0);
	if (!Number.isFinite(parsed) || parsed < 0) {
		httpError(400, 'sortOrder must be a non-negative integer', 'INVALID_REQUEST_BODY');
	}
	return Math.floor(parsed);
}

function normalizeBoolean(value: unknown, fallback = false) {
	if (typeof value === 'boolean') return value;
	if (value === 'true') return true;
	if (value === 'false') return false;
	return fallback;
}

function normalizeMediaId(value: unknown) {
	if (value === null || value === undefined || value === '') return null;
	const relationRef = extractRelationRef(value);
	const parsed = Number(relationRef ?? value);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		httpError(400, 'qrImage is invalid', 'PAYMENT_PROFILE_INVALID_QR_IMAGE');
	}
	return parsed;
}

function isPostgresClient() {
	const client = String(strapi.db?.connection?.client?.config?.client || '').toLowerCase();
	return client.includes('pg');
}

async function acquirePaymentProfileCodeLock(trx: any, tenantId: number | string, code: string) {
	if (!isPostgresClient()) return;
	await trx.raw('select pg_advisory_xact_lock(hashtext(?), hashtext(?))', [String(tenantId), `payment-profile-code:${String(code || '').toUpperCase()}`]);
}

async function acquirePaymentProfileDefaultLock(trx: any, tenantId: number | string) {
	if (!isPostgresClient()) return;
	await trx.raw('select pg_advisory_xact_lock(hashtext(?), hashtext(?))', [String(tenantId), 'payment-profile-default']);
}

function mapMedia(media: any) {
	if (!media?.id) return null;
	return {
		id: Number(media.id),
		name: normalizeText(media.name) || null,
		url: normalizeText(media.url) || null,
		mime: normalizeText(media.mime) || null,
	};
}

function mapPaymentProfileRow(row: any, options: { includeLongText?: boolean } = {}) {
	return {
		id: Number(row?.id || 0),
		documentId: row?.documentId || null,
		name: normalizeText(row?.name),
		code: normalizeText(row?.code),
		description: options.includeLongText ? normalizeOptionalText(row?.description) : normalizeOptionalText(row?.description, 240),
		paymentMethod: normalizeText(row?.paymentMethod).toLowerCase() || 'bank_transfer',
		bankCode: normalizeOptionalText(row?.bankCode),
		bankName: normalizeOptionalText(row?.bankName),
		accountNumber: normalizeOptionalText(row?.accountNumber),
		accountHolder: normalizeOptionalText(row?.accountHolder),
		bankBranch: normalizeOptionalText(row?.bankBranch),
		currency: normalizeText(row?.currency) || 'VND',
		transferContentTemplate: normalizeOptionalText(row?.transferContentTemplate),
		paymentInstruction: normalizeOptionalText(row?.paymentInstruction),
		supportPhone: normalizeOptionalText(row?.supportPhone),
		supportEmail: normalizeOptionalText(row?.supportEmail),
		isActive: row?.isActive !== false,
		isDefault: row?.isDefault === true,
		sortOrder: Number(row?.sortOrder || 0) || 0,
		qrImage: mapMedia(row?.qrImage),
		createdAt: row?.createdAt || null,
		updatedAt: row?.updatedAt || null,
	};
}

function buildListWhere(query: Record<string, unknown>) {
	const clauses: Array<Record<string, unknown>> = [];
	const keyword = normalizeText(query.search ?? query.q);
	const paymentMethod = normalizeText(query.paymentMethod).toLowerCase();
	const isActive = normalizeText(query.isActive).toLowerCase();
	const isDefault = normalizeText(query.isDefault).toLowerCase();

	if (keyword) {
		clauses.push({
			$or: [
				{ name: { $containsi: keyword } },
				{ code: { $containsi: keyword } },
				{ bankName: { $containsi: keyword } },
				{ accountNumber: { $containsi: keyword } },
				{ accountHolder: { $containsi: keyword } },
			],
		});
	}

	if (paymentMethod) clauses.push({ paymentMethod: { $eq: paymentMethod } });
	if (isActive === 'true' || isActive === 'false') clauses.push({ isActive: { $eq: isActive === 'true' } });
	if (isDefault === 'true' || isDefault === 'false') clauses.push({ isDefault: { $eq: isDefault === 'true' } });

	if (clauses.length === 0) return {};
	if (clauses.length === 1) return clauses[0];
	return { $and: clauses };
}

function resolveOrderBy(query: Record<string, unknown>) {
	const normalizedSort = normalizeSortInput(query?.sort);
	if (normalizedSort.length > 0) {
		const allowed = new Set(['name', 'code', 'paymentMethod', 'isActive', 'isDefault', 'sortOrder', 'updatedAt', 'createdAt']);
		const safe = normalizedSort
			.map((entry) => {
				const key = Object.keys(entry)[0];
				if (!allowed.has(key)) return null;
				return { [key]: entry[key] } as Record<string, 'asc' | 'desc'>;
			})
			.filter(Boolean) as Array<Record<string, 'asc' | 'desc'>>;
		if (safe.length > 0) return safe;
	}

	return [{ isDefault: 'desc' }, { isActive: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }];
}

async function findPaymentProfileInTenant(tenantId: number | string, profileRef: unknown, transacting?: any) {
	const where = whereByParam(profileRef);
	if (!where) {
		httpError(404, 'Payment profile not found', 'PAYMENT_PROFILE_NOT_FOUND');
	}

	const profile = await strapi.db.query(PAYMENT_PROFILE_UID).findOne({
		where: mergeTenantWhere(where, tenantId),
		populate: {
			qrImage: { select: ['id', 'name', 'url', 'mime'] },
		},
		...(transacting ? { transacting } : {}),
	} as any) as any;

	if (!profile?.id) {
		httpError(404, 'Payment profile not found', 'PAYMENT_PROFILE_NOT_FOUND');
	}

	return profile;
}

async function findPaymentProfileByCode(tenantId: number | string, code: string, transacting?: any) {
	if (!code) return null;
	return await strapi.db.query(PAYMENT_PROFILE_UID).findOne({
		where: mergeTenantWhere({ code: { $eq: code } }, tenantId),
		select: ['id', 'documentId', 'code', 'isActive', 'isDefault'],
		...(transacting ? { transacting } : {}),
	} as any);
}

async function listDefaultProfiles(tenantId: number | string, transacting?: any) {
	return await strapi.db.query(PAYMENT_PROFILE_UID).findMany({
		where: mergeTenantWhere({ isDefault: true }, tenantId),
		select: ['id'],
		...(transacting ? { transacting } : {}),
	} as any) as any[];
}

async function clearOtherDefaultProfiles(tenantId: number | string, currentId?: number | null, transacting?: any) {
	const rows = await listDefaultProfiles(tenantId, transacting);
	for (const row of rows || []) {
		const rowId = Number(row?.id || 0);
		if (!rowId || (currentId && rowId === currentId)) continue;
		await strapi.db.query(PAYMENT_PROFILE_UID).update({
			where: { id: rowId },
			data: { isDefault: false },
			...(transacting ? { transacting } : {}),
		} as any);
	}
}

function ensureNoUnknownWriteFields(payload: GenericRecord) {
	ensureNoUnknownFields(payload, [
		'name', 'code', 'description', 'paymentMethod', 'bankCode', 'bankName', 'accountNumber', 'accountHolder',
		'bankBranch', 'currency', 'transferContentTemplate', 'paymentInstruction', 'supportPhone', 'supportEmail',
		'qrImage', 'isActive', 'isDefault', 'sortOrder',
	]);
}

function buildWriteData(input: GenericRecord, existing: any = null) {
	const paymentMethod = hasOwn(input, 'paymentMethod') ? normalizePaymentMethod(input.paymentMethod) : normalizePaymentMethod(existing?.paymentMethod);
	const data = {
		name: hasOwn(input, 'name') ? normalizeRequiredText(input.name, 'name', 150) : normalizeRequiredText(existing?.name, 'name', 150),
		code: hasOwn(input, 'code') ? normalizeCode(input.code) : normalizeCode(existing?.code),
		description: hasOwn(input, 'description') ? normalizeOptionalText(input.description) : normalizeOptionalText(existing?.description),
		paymentMethod,
		bankCode: hasOwn(input, 'bankCode') ? normalizeOptionalText(input.bankCode, 20)?.toUpperCase() || null : normalizeOptionalText(existing?.bankCode, 20)?.toUpperCase() || null,
		bankName: hasOwn(input, 'bankName') ? normalizeOptionalText(input.bankName, 150) : normalizeOptionalText(existing?.bankName, 150),
		accountNumber: hasOwn(input, 'accountNumber') ? normalizeOptionalText(input.accountNumber, 100) : normalizeOptionalText(existing?.accountNumber, 100),
		accountHolder: hasOwn(input, 'accountHolder') ? normalizeOptionalText(input.accountHolder, 150) : normalizeOptionalText(existing?.accountHolder, 150),
		bankBranch: hasOwn(input, 'bankBranch') ? normalizeOptionalText(input.bankBranch, 150) : normalizeOptionalText(existing?.bankBranch, 150),
		currency: hasOwn(input, 'currency') ? normalizeCurrency(input.currency) : normalizeCurrency(existing?.currency || 'VND'),
		transferContentTemplate: hasOwn(input, 'transferContentTemplate') ? normalizeOptionalText(input.transferContentTemplate, 255) : normalizeOptionalText(existing?.transferContentTemplate, 255),
		paymentInstruction: hasOwn(input, 'paymentInstruction') ? normalizeOptionalText(input.paymentInstruction) : normalizeOptionalText(existing?.paymentInstruction),
		supportPhone: hasOwn(input, 'supportPhone') ? normalizeOptionalText(input.supportPhone, 30) : normalizeOptionalText(existing?.supportPhone, 30),
		supportEmail: hasOwn(input, 'supportEmail') ? normalizeEmail(input.supportEmail) : normalizeEmail(existing?.supportEmail),
		isActive: hasOwn(input, 'isActive') ? normalizeBoolean(input.isActive, true) : (existing?.isActive !== false),
		isDefault: hasOwn(input, 'isDefault') ? normalizeBoolean(input.isDefault, false) : (existing?.isDefault === true),
		sortOrder: hasOwn(input, 'sortOrder') ? normalizeSortOrder(input.sortOrder) : normalizeSortOrder(existing?.sortOrder ?? 0),
		qrImage: hasOwn(input, 'qrImage') ? normalizeMediaId(input.qrImage) : (existing?.qrImage?.id ? Number(existing.qrImage.id) : null),
	};

	if (paymentMethod === 'bank_transfer') {
		if (!data.bankCode && !data.bankName) {
			httpError(400, 'Bank information is required for bank transfer profiles.', 'PAYMENT_PROFILE_BANK_INFO_REQUIRED', { field: 'bankName' });
		}
		if (!data.accountNumber) {
			httpError(400, 'accountNumber is required for bank transfer profiles.', 'PAYMENT_PROFILE_BANK_INFO_REQUIRED', { field: 'accountNumber' });
		}
		if (!data.accountHolder) {
			httpError(400, 'accountHolder is required for bank transfer profiles.', 'PAYMENT_PROFILE_BANK_INFO_REQUIRED', { field: 'accountHolder' });
		}
	}

	if (data.isDefault && !data.isActive) {
		httpError(409, 'Inactive payment profile cannot be default.', 'PAYMENT_PROFILE_INACTIVE_CANNOT_BE_DEFAULT');
	}

	return data;
}

export async function listTenantPaymentProfiles(query: Record<string, unknown> = {}, tenantId: number | string) {
	const page = toPositiveInt(query?.page ?? query?.['pagination[page]'], 1);
	const pageSize = Math.min(100, toPositiveInt(query?.pageSize ?? query?.['pagination[pageSize]'], 10));
	const where = mergeTenantWhere(buildListWhere(query), tenantId);
	const orderBy = resolveOrderBy(query);

	const [rows, total] = await Promise.all([
		strapi.db.query(PAYMENT_PROFILE_UID).findMany({
			where,
			select: ['id', 'documentId', 'name', 'code', 'description', 'paymentMethod', 'bankCode', 'bankName', 'accountNumber', 'accountHolder', 'currency', 'isActive', 'isDefault', 'sortOrder', 'createdAt', 'updatedAt'],
			populate: { qrImage: { select: ['id', 'name', 'url', 'mime'] } },
			orderBy,
			offset: (page - 1) * pageSize,
			limit: pageSize,
		} as any),
		strapi.db.query(PAYMENT_PROFILE_UID).count({ where } as any),
	]);

	return {
		rows: (rows || []).map((row: any) => mapPaymentProfileRow(row)),
		pagination: { page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
	};
}

export async function getTenantPaymentProfile(profileRef: unknown, tenantId: number | string) {
	const row = await findPaymentProfileInTenant(tenantId, profileRef);
	return mapPaymentProfileRow(row, { includeLongText: true });
}

export async function createTenantPaymentProfile(payload: Record<string, unknown>, tenantId: number | string) {
	ensureNoUnknownWriteFields(payload || {});

	try {
		return await strapi.db.connection.transaction(async (trx: any) => {
			const data = buildWriteData(payload || {});
			await acquirePaymentProfileCodeLock(trx, tenantId, data.code);
			if (data.isDefault) await acquirePaymentProfileDefaultLock(trx, tenantId);

			const duplicate = await findPaymentProfileByCode(tenantId, data.code, trx);
			if (duplicate?.id) {
				httpError(409, 'Payment profile code already exists in this tenant.', 'PAYMENT_PROFILE_CODE_ALREADY_EXISTS', { field: 'code' });
			}

			if (data.isDefault) await clearOtherDefaultProfiles(tenantId, null, trx);

			const created = await strapi.db.query(PAYMENT_PROFILE_UID).create({
				data: { ...data, tenant: tenantId },
				transacting: trx,
			} as any) as any;

			const fresh = await findPaymentProfileInTenant(tenantId, created.id, trx);
			return mapPaymentProfileRow(fresh, { includeLongText: true });
		});
	} catch (error: any) {
		if (error instanceof PaymentProfileError) throw error;
		if (error instanceof errors.ApplicationError) {
			const message = String(error.message || 'Invalid payment profile payload');
			if (/tenant \+ code must be unique/i.test(message)) httpError(409, 'Payment profile code already exists in this tenant.', 'PAYMENT_PROFILE_CODE_ALREADY_EXISTS', { field: 'code' });
			if (/tenant can only have one default payment profile/i.test(message)) httpError(409, 'Tenant can only have one default payment profile.', 'PAYMENT_PROFILE_ALREADY_DEFAULT');
			if (/supportEmail is invalid/i.test(message)) httpError(400, 'supportEmail is invalid', 'INVALID_EMAIL', { field: 'supportEmail' });
			if (/bankCode or bankName is required/i.test(message) || /accountNumber is required/i.test(message) || /accountHolder is required/i.test(message)) httpError(400, message, 'PAYMENT_PROFILE_BANK_INFO_REQUIRED');
			throw error;
		}
		throw error;
	}
}

export async function updateTenantPaymentProfile(profileRef: unknown, payload: Record<string, unknown>, tenantId: number | string) {
	ensureNoUnknownWriteFields(payload || {});

	try {
		return await strapi.db.connection.transaction(async (trx: any) => {
			const existing = await findPaymentProfileInTenant(tenantId, profileRef, trx);
			const data = buildWriteData(payload || {}, existing);
			await acquirePaymentProfileCodeLock(trx, tenantId, data.code);
			if (data.isDefault || existing.isDefault === true) await acquirePaymentProfileDefaultLock(trx, tenantId);

			const duplicate = await findPaymentProfileByCode(tenantId, data.code, trx);
			if (duplicate?.id && Number(duplicate.id) !== Number(existing.id)) {
				httpError(409, 'Payment profile code already exists in this tenant.', 'PAYMENT_PROFILE_CODE_ALREADY_EXISTS', { field: 'code' });
			}

			if (existing.isDefault === true && data.isActive === false) {
				httpError(409, 'Default payment profile cannot be deactivated.', 'PAYMENT_PROFILE_DEFAULT_CANNOT_BE_DEACTIVATED');
			}

			if (data.isDefault) await clearOtherDefaultProfiles(tenantId, Number(existing.id), trx);

			await strapi.db.query(PAYMENT_PROFILE_UID).update({
				where: { id: existing.id },
				data,
				transacting: trx,
			} as any);

			const fresh = await findPaymentProfileInTenant(tenantId, existing.id, trx);
			return mapPaymentProfileRow(fresh, { includeLongText: true });
		});
	} catch (error: any) {
		if (error instanceof PaymentProfileError) throw error;
		if (error instanceof errors.ApplicationError) {
			const message = String(error.message || 'Invalid payment profile payload');
			if (/tenant \+ code must be unique/i.test(message)) httpError(409, 'Payment profile code already exists in this tenant.', 'PAYMENT_PROFILE_CODE_ALREADY_EXISTS', { field: 'code' });
			if (/tenant can only have one default payment profile/i.test(message)) httpError(409, 'Tenant can only have one default payment profile.', 'PAYMENT_PROFILE_ALREADY_DEFAULT');
			if (/supportEmail is invalid/i.test(message)) httpError(400, 'supportEmail is invalid', 'INVALID_EMAIL', { field: 'supportEmail' });
			if (/bankCode or bankName is required/i.test(message) || /accountNumber is required/i.test(message) || /accountHolder is required/i.test(message)) httpError(400, message, 'PAYMENT_PROFILE_BANK_INFO_REQUIRED');
			throw error;
		}
		throw error;
	}
}

export async function setDefaultTenantPaymentProfile(profileRef: unknown, tenantId: number | string) {
	return await strapi.db.connection.transaction(async (trx: any) => {
		const existing = await findPaymentProfileInTenant(tenantId, profileRef, trx);
		await acquirePaymentProfileDefaultLock(trx, tenantId);

		if (existing.isDefault === true) {
			httpError(409, 'Payment profile is already default.', 'PAYMENT_PROFILE_ALREADY_DEFAULT');
		}
		if (existing.isActive === false) {
			httpError(409, 'Inactive payment profile cannot be default.', 'PAYMENT_PROFILE_INACTIVE_CANNOT_BE_DEFAULT');
		}

		await clearOtherDefaultProfiles(tenantId, Number(existing.id), trx);
		await strapi.db.query(PAYMENT_PROFILE_UID).update({
			where: { id: existing.id },
			data: { isDefault: true },
			transacting: trx,
		} as any);

		const fresh = await findPaymentProfileInTenant(tenantId, existing.id, trx);
		return mapPaymentProfileRow(fresh, { includeLongText: true });
	});
}

export async function activateTenantPaymentProfile(profileRef: unknown, tenantId: number | string) {
	const existing = await findPaymentProfileInTenant(tenantId, profileRef);
	await strapi.db.query(PAYMENT_PROFILE_UID).update({ where: { id: existing.id }, data: { isActive: true } } as any);
	const fresh = await findPaymentProfileInTenant(tenantId, existing.id);
	return mapPaymentProfileRow(fresh, { includeLongText: true });
}

export async function deactivateTenantPaymentProfile(profileRef: unknown, tenantId: number | string) {
	const existing = await findPaymentProfileInTenant(tenantId, profileRef);
	if (existing.isDefault === true) {
		httpError(409, 'Default payment profile cannot be deactivated.', 'PAYMENT_PROFILE_DEFAULT_CANNOT_BE_DEACTIVATED');
	}

	await strapi.db.query(PAYMENT_PROFILE_UID).update({ where: { id: existing.id }, data: { isActive: false } } as any);
	const fresh = await findPaymentProfileInTenant(tenantId, existing.id);
	return mapPaymentProfileRow(fresh, { includeLongText: true });
}

export function handlePaymentProfileError(ctx: any, error: unknown) {
	if (error instanceof PaymentProfileError) {
		const body = {
			error: error.message,
			...(error.code ? { code: error.code } : {}),
			status: error.status,
			...(error.details ? { details: error.details } : {}),
		};
		ctx.status = error.status;
		ctx.body = body;
		return;
	}
	if (error instanceof errors.ApplicationError) {
		return ctx.badRequest(error.message);
	}
	strapi.log.error('[payment-profile] unexpected error', error);
	return ctx.internalServerError('Failed to process payment profile request');
}

export default factories.createCoreService(PAYMENT_PROFILE_UID);