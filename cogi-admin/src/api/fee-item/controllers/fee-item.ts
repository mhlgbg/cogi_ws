import { resolveCurrentTenantId, toPositiveInt, toText } from '../../../utils/tenant-scope';

type RelationMode = 'feeSheetClass' | 'direct';

type ListingFilters = {
	tenantId: number | string;
	feeSheetId: number;
	keyword: string;
	classId: number | null;
	feeItemPaymentStatus: string;
};

async function resolveUserFromJwt(ctx: any) {
	try {
		const authHeader = ctx.request?.headers?.authorization || ctx.request?.header?.authorization || '';
		const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
			? authHeader.slice(7).trim()
			: '';

		if (!token) return null;

		const jwtService = strapi.plugin('users-permissions')?.service('jwt');
		if (!jwtService) return null;

		const decoded = await jwtService.verify(token);
		const userId = Number(decoded?.id);
		if (!Number.isInteger(userId) || userId <= 0) return null;

		return strapi.db.query('plugin::users-permissions.user').findOne({
			where: { id: userId },
			select: ['id', 'username', 'email', 'blocked'],
		});
	} catch {
		return null;
	}
}

async function requireAuthenticatedUser(ctx: any) {
	let authUser = ctx.state?.user;
	if (!authUser?.id) {
		authUser = await resolveUserFromJwt(ctx);
		if (authUser?.id) ctx.state.user = authUser;
	}

	if (!authUser?.id) {
		ctx.unauthorized('Unauthorized');
		return null;
	}

	if (authUser?.blocked) {
		ctx.unauthorized('Account is blocked');
		return null;
	}

	return authUser;
}

async function getTableColumns(tableName: string): Promise<Set<string>> {
	const rows = await strapi.db.connection('information_schema.columns')
		.select('column_name')
		.where({ table_schema: 'public', table_name: tableName });

	return new Set(rows.map((row: { column_name: string }) => row.column_name));
}

function hasRequiredColumns(columns: Set<string>, requiredColumns: string[]) {
	return requiredColumns.every((columnName) => columns.has(columnName));
}

async function detectRelationMode(): Promise<RelationMode> {
	const feeSheetClassLinkColumns = await getTableColumns('fee_items_fee_sheet_class_lnk');
	if (hasRequiredColumns(feeSheetClassLinkColumns, ['fee_item_id', 'fee_sheet_class_id'])) {
		return 'feeSheetClass';
	}

	const classLinkColumns = await getTableColumns('fee_items_class_lnk');
	const feeSheetLinkColumns = await getTableColumns('fee_items_fee_sheet_lnk');
	if (
		hasRequiredColumns(classLinkColumns, ['fee_item_id', 'class_id'])
		&& hasRequiredColumns(feeSheetLinkColumns, ['fee_item_id', 'fee_sheet_id'])
	) {
		return 'direct';
	}

	throw new Error('Fee item relation tables were not found');
}

function toOptionalPositiveInt(value: unknown): number | null {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toMoney(value: unknown) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function buildJoinSql(relationMode: RelationMode) {
	if (relationMode === 'feeSheetClass') {
		return `
			FROM fee_items fi
			INNER JOIN fee_items_learner_lnk learner_link
				ON learner_link.fee_item_id = fi.id
			INNER JOIN learners learner
				ON learner.id = learner_link.learner_id
			INNER JOIN fee_items_tenant_lnk tenant_link
				ON tenant_link.fee_item_id = fi.id
			INNER JOIN fee_items_fee_sheet_class_lnk fee_sheet_class_link
				ON fee_sheet_class_link.fee_item_id = fi.id
			INNER JOIN fee_sheet_classes fee_sheet_class
				ON fee_sheet_class.id = fee_sheet_class_link.fee_sheet_class_id
			INNER JOIN fee_sheet_classes_class_lnk class_link
				ON class_link.fee_sheet_class_id = fee_sheet_class.id
			INNER JOIN classes class_entity
				ON class_entity.id = class_link.class_id
			INNER JOIN fee_sheet_classes_fee_sheet_lnk fee_sheet_link
				ON fee_sheet_link.fee_sheet_class_id = fee_sheet_class.id
			INNER JOIN fee_sheets fee_sheet
				ON fee_sheet.id = fee_sheet_link.fee_sheet_id
		`;
	}

	return `
		FROM fee_items fi
		INNER JOIN fee_items_learner_lnk learner_link
			ON learner_link.fee_item_id = fi.id
		INNER JOIN learners learner
			ON learner.id = learner_link.learner_id
		INNER JOIN fee_items_tenant_lnk tenant_link
			ON tenant_link.fee_item_id = fi.id
		INNER JOIN fee_items_class_lnk class_link
			ON class_link.fee_item_id = fi.id
		INNER JOIN classes class_entity
			ON class_entity.id = class_link.class_id
		INNER JOIN fee_items_fee_sheet_lnk fee_sheet_link
			ON fee_sheet_link.fee_item_id = fi.id
		INNER JOIN fee_sheets fee_sheet
			ON fee_sheet.id = fee_sheet_link.fee_sheet_id
	`;
}

function buildWhereClause(filters: ListingFilters) {
	const clauses = ['tenant_link.tenant_id = ?', 'fee_sheet.id = ?'];
	const params: Array<string | number> = [filters.tenantId, filters.feeSheetId];

	if (filters.keyword) {
		clauses.push(`LOWER(COALESCE(NULLIF(fi.learner_name_snapshot, ''), NULLIF(learner.full_name, ''), NULLIF(learner.code, ''))) LIKE ?`);
		params.push(`%${filters.keyword.toLowerCase()}%`);
	}

	if (filters.classId) {
		clauses.push('class_entity.id = ?');
		params.push(filters.classId);
	}

	if (filters.feeItemPaymentStatus) {
		clauses.push('LOWER(COALESCE(fi.fee_item_payment_status, ?)) = ?');
		params.push('unpaid', filters.feeItemPaymentStatus.toLowerCase());
	}

	return {
		whereSql: `WHERE ${clauses.join(' AND ')}`,
		params,
	};
}

function normalizeRow(row: any) {
	const amount = toMoney(row?.amount);
	const paidAmount = toMoney(row?.paid_amount);
	const remaining = toMoney(row?.remaining);

	return {
		id: row?.id,
		learner: {
			id: row?.learner_id,
			name: row?.learner_name || '',
		},
		class: {
			id: row?.class_id,
			name: row?.class_name || '',
		},
		quantity: Number(row?.quantity || 0),
		unitPrice: toMoney(row?.unit_price),
		amount,
		paidAmount,
		remaining,
		feeItemPaymentStatus: row?.feeItemPaymentStatus || row?.status || 'unpaid',
		status: row?.feeItemPaymentStatus || row?.status || 'unpaid',
	};
}

export default {
	async listing(ctx: any) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const query = (ctx.query || {}) as Record<string, unknown>;
		const feeSheetId = toOptionalPositiveInt(query.feeSheetId);

		if (!feeSheetId) {
			return ctx.badRequest('feeSheetId is required');
		}

		const page = toPositiveInt(query.page, 1);
		const pageSize = Math.min(100, toPositiveInt(query.pageSize, 20));
		const offset = (page - 1) * pageSize;
		const keyword = toText(query.keyword);
		const classId = toOptionalPositiveInt(query.classId);
		const feeItemPaymentStatus = toText(query.feeItemPaymentStatus || query.status).toLowerCase();
		const allowedStatus = ['unpaid', 'partial', 'paid'];

		if (feeItemPaymentStatus && !allowedStatus.includes(feeItemPaymentStatus)) {
			return ctx.badRequest('status must be one of: unpaid, partial, paid');
		}

		try {
			const relationMode = await detectRelationMode();
			const joinSql = buildJoinSql(relationMode);
			const { whereSql, params } = buildWhereClause({
				tenantId,
				feeSheetId,
				keyword,
				classId,
				feeItemPaymentStatus,
			});

			const rowsSql = `
				SELECT
					fi.id,
					learner.id AS learner_id,
					COALESCE(NULLIF(fi.learner_name_snapshot, ''), NULLIF(learner.full_name, ''), NULLIF(learner.code, ''), 'Learner #' || learner.id::text) AS learner_name,
					class_entity.id AS class_id,
					COALESCE(NULLIF(class_entity.name, ''), 'Class #' || class_entity.id::text) AS class_name,
					COALESCE(fi.sessions, 0) AS quantity,
					COALESCE(fi.unit_price, 0) AS unit_price,
					COALESCE(fi.amount, 0) AS amount,
					COALESCE(fi.paid_amount, 0) AS paid_amount,
					GREATEST(COALESCE(fi.amount, 0) - COALESCE(fi.paid_amount, 0), 0) AS remaining,
					COALESCE(fi.fee_item_payment_status, 'unpaid') AS feeItemPaymentStatus
				${joinSql}
				${whereSql}
				ORDER BY class_entity.name ASC, learner_name ASC, fi.id DESC
				LIMIT ? OFFSET ?
			`;

			const summarySql = `
				SELECT
					COUNT(DISTINCT fi.id) AS total,
					COALESCE(SUM(COALESCE(fi.amount, 0)), 0) AS total_amount,
					COALESCE(SUM(COALESCE(fi.paid_amount, 0)), 0) AS total_paid,
					COALESCE(SUM(GREATEST(COALESCE(fi.amount, 0) - COALESCE(fi.paid_amount, 0), 0)), 0) AS total_remaining
				${joinSql}
				${whereSql}
			`;

			const [rowsResult, summaryResult] = await Promise.all([
				strapi.db.connection.raw(rowsSql, [...params, pageSize, offset]),
				strapi.db.connection.raw(summarySql, params),
			]);

			const rows = Array.isArray((rowsResult as any)?.rows) ? (rowsResult as any).rows : [];
			const summaryRow = (summaryResult as any)?.rows?.[0] || {};

			ctx.body = {
				data: rows.map(normalizeRow),
				pagination: {
					page,
					pageSize,
					total: Number(summaryRow.total || 0),
				},
				summary: {
					totalAmount: toMoney(summaryRow.total_amount),
					totalPaid: toMoney(summaryRow.total_paid),
					totalRemaining: toMoney(summaryRow.total_remaining),
				},
			};
		} catch (error: any) {
			return ctx.badRequest(error?.message || 'Failed to load fee items');
		}
	},
};