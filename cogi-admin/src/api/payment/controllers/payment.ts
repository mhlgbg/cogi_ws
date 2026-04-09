import { resolveCurrentTenantId, toPositiveInt, toText } from '../../../utils/tenant-scope';

type FeeItemRelationMode = 'feeSheetClass' | 'direct';

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

async function detectFeeItemRelationMode(): Promise<FeeItemRelationMode> {
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

function normalizeMethod(value: unknown) {
	const normalized = toText(value).toLowerCase();
	if (['cash', 'transfer', 'other'].includes(normalized)) return normalized;
	return '';
}

function buildPaymentListWhere(filters: {
	tenantId: number | string;
	keyword: string;
	method: string;
	dateFrom: string;
	dateTo: string;
}) {
	const clauses = ['tenant_link.tenant_id = ?'];
	const params: Array<string | number> = [filters.tenantId];

	if (filters.keyword) {
		clauses.push(`(
			LOWER(COALESCE(NULLIF(learner.full_name, ''), NULLIF(learner.code, ''), '')) LIKE ?
			OR LOWER(COALESCE(p.note, '')) LIKE ?
		)`);
		params.push(`%${filters.keyword.toLowerCase()}%`, `%${filters.keyword.toLowerCase()}%`);
	}

	if (filters.method) {
		clauses.push('LOWER(COALESCE(p.method, ?)) = ?');
		params.push('cash', filters.method);
	}

	if (filters.dateFrom) {
		clauses.push('p.payment_date >= ?');
		params.push(filters.dateFrom);
	}

	if (filters.dateTo) {
		clauses.push('p.payment_date <= ?');
		params.push(filters.dateTo);
	}

	return {
		whereSql: `WHERE ${clauses.join(' AND ')}`,
		params,
	};
}

function normalizePaymentRow(row: any) {
	return {
		id: row?.id,
		learner: {
			id: row?.learner_id,
			name: row?.learner_name || '',
		},
		amount: toMoney(row?.amount),
		paymentDate: row?.payment_date || null,
		method: row?.method || 'cash',
		note: row?.note || '',
		allocationCount: Number(row?.allocation_count || 0),
		allocatedAmount: toMoney(row?.allocated_amount),
		unallocatedAmount: toMoney(row?.unallocated_amount),
	};
}

function normalizeAllocationRow(row: any) {
	return {
		id: row?.id,
		amount: toMoney(row?.allocation_amount),
		feeItem: {
			id: row?.fee_item_id,
			learnerName: row?.fee_item_learner_name || '',
			className: row?.class_name || '',
			feeSheetName: row?.fee_sheet_name || '',
			feeItemAmount: toMoney(row?.fee_item_amount),
			feeItemPaidAmount: toMoney(row?.fee_item_paid_amount),
			feeItemRemaining: toMoney(row?.fee_item_remaining),
			status: row?.fee_item_status || 'unpaid',
		},
	};
}

function buildAllocationJoinSql(relationMode: FeeItemRelationMode) {
	if (relationMode === 'feeSheetClass') {
		return `
			FROM payment_allocations allocation
			INNER JOIN payment_allocations_payment_lnk allocation_payment_link
				ON allocation_payment_link.payment_allocation_id = allocation.id
			INNER JOIN payment_allocations_tenant_lnk allocation_tenant_link
				ON allocation_tenant_link.payment_allocation_id = allocation.id
			INNER JOIN payment_allocations_fee_item_lnk allocation_fee_item_link
				ON allocation_fee_item_link.payment_allocation_id = allocation.id
			INNER JOIN fee_items fee_item
				ON fee_item.id = allocation_fee_item_link.fee_item_id
			INNER JOIN fee_items_fee_sheet_class_lnk fee_item_fee_sheet_class_link
				ON fee_item_fee_sheet_class_link.fee_item_id = fee_item.id
			INNER JOIN fee_sheet_classes fee_sheet_class
				ON fee_sheet_class.id = fee_item_fee_sheet_class_link.fee_sheet_class_id
			INNER JOIN fee_sheet_classes_class_lnk fee_sheet_class_class_link
				ON fee_sheet_class_class_link.fee_sheet_class_id = fee_sheet_class.id
			INNER JOIN classes class_entity
				ON class_entity.id = fee_sheet_class_class_link.class_id
			INNER JOIN fee_sheet_classes_fee_sheet_lnk fee_sheet_class_fee_sheet_link
				ON fee_sheet_class_fee_sheet_link.fee_sheet_class_id = fee_sheet_class.id
			INNER JOIN fee_sheets fee_sheet
				ON fee_sheet.id = fee_sheet_class_fee_sheet_link.fee_sheet_id
		`;
	}

	return `
		FROM payment_allocations allocation
		INNER JOIN payment_allocations_payment_lnk allocation_payment_link
			ON allocation_payment_link.payment_allocation_id = allocation.id
		INNER JOIN payment_allocations_tenant_lnk allocation_tenant_link
			ON allocation_tenant_link.payment_allocation_id = allocation.id
		INNER JOIN payment_allocations_fee_item_lnk allocation_fee_item_link
			ON allocation_fee_item_link.payment_allocation_id = allocation.id
		INNER JOIN fee_items fee_item
			ON fee_item.id = allocation_fee_item_link.fee_item_id
		INNER JOIN fee_items_class_lnk fee_item_class_link
			ON fee_item_class_link.fee_item_id = fee_item.id
		INNER JOIN classes class_entity
			ON class_entity.id = fee_item_class_link.class_id
		INNER JOIN fee_items_fee_sheet_lnk fee_item_fee_sheet_link
			ON fee_item_fee_sheet_link.fee_item_id = fee_item.id
		INNER JOIN fee_sheets fee_sheet
			ON fee_sheet.id = fee_item_fee_sheet_link.fee_sheet_id
	`;
}

export default {
	async tracking(ctx: any) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const query = (ctx.query || {}) as Record<string, unknown>;
		const page = toPositiveInt(query.page, 1);
		const pageSize = Math.min(100, toPositiveInt(query.pageSize, 20));
		const offset = (page - 1) * pageSize;
		const keyword = toText(query.keyword);
		const method = normalizeMethod(query.method);
		const dateFrom = toText(query.dateFrom);
		const dateTo = toText(query.dateTo);

		try {
			const { whereSql, params } = buildPaymentListWhere({ tenantId, keyword, method, dateFrom, dateTo });
			const joinSql = `
				FROM payments p
				INNER JOIN payments_learner_lnk learner_link
					ON learner_link.payment_id = p.id
				INNER JOIN learners learner
					ON learner.id = learner_link.learner_id
				INNER JOIN payments_tenant_lnk tenant_link
					ON tenant_link.payment_id = p.id
				LEFT JOIN (
					SELECT
						allocation_payment_link.payment_id AS payment_id,
						COUNT(allocation.id) AS allocation_count,
						COALESCE(SUM(COALESCE(allocation.amount, 0)), 0) AS allocated_amount
					FROM payment_allocations allocation
					INNER JOIN payment_allocations_payment_lnk allocation_payment_link
						ON allocation_payment_link.payment_allocation_id = allocation.id
					INNER JOIN payment_allocations_tenant_lnk allocation_tenant_link
						ON allocation_tenant_link.payment_allocation_id = allocation.id
					WHERE allocation_tenant_link.tenant_id = ?
					GROUP BY allocation_payment_link.payment_id
				) allocation_summary
					ON allocation_summary.payment_id = p.id
			`;

			const baseParams = [tenantId, ...params];

			const rowsSql = `
				SELECT
					p.id,
					learner.id AS learner_id,
					COALESCE(NULLIF(learner.full_name, ''), NULLIF(learner.code, ''), 'Learner #' || learner.id::text) AS learner_name,
					COALESCE(p.amount, 0) AS amount,
					p.payment_date,
					COALESCE(p.method, 'cash') AS method,
					COALESCE(p.note, '') AS note,
					COALESCE(allocation_summary.allocation_count, 0) AS allocation_count,
					COALESCE(allocation_summary.allocated_amount, 0) AS allocated_amount,
					GREATEST(COALESCE(p.amount, 0) - COALESCE(allocation_summary.allocated_amount, 0), 0) AS unallocated_amount
				${joinSql}
				${whereSql}
				ORDER BY p.payment_date DESC, p.id DESC
				LIMIT ? OFFSET ?
			`;

			const summarySql = `
				SELECT
					COUNT(DISTINCT p.id) AS total,
					COALESCE(SUM(COALESCE(p.amount, 0)), 0) AS total_amount,
					COALESCE(SUM(COALESCE(allocation_summary.allocated_amount, 0)), 0) AS total_allocated,
					COALESCE(SUM(GREATEST(COALESCE(p.amount, 0) - COALESCE(allocation_summary.allocated_amount, 0), 0)), 0) AS total_unallocated
				${joinSql}
				${whereSql}
			`;

			const [rowsResult, summaryResult] = await Promise.all([
				strapi.db.connection.raw(rowsSql, [...baseParams, pageSize, offset]),
				strapi.db.connection.raw(summarySql, baseParams),
			]);

			const rows = Array.isArray((rowsResult as any)?.rows) ? (rowsResult as any).rows : [];
			const summaryRow = (summaryResult as any)?.rows?.[0] || {};

			ctx.body = {
				data: rows.map(normalizePaymentRow),
				pagination: {
					page,
					pageSize,
					total: Number(summaryRow.total || 0),
				},
				summary: {
					totalAmount: toMoney(summaryRow.total_amount),
					totalAllocated: toMoney(summaryRow.total_allocated),
					totalUnallocated: toMoney(summaryRow.total_unallocated),
				},
			};
		} catch (error: any) {
			return ctx.badRequest(error?.message || 'Failed to load payments');
		}
	},

	async trackingDetail(ctx: any) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const paymentId = toOptionalPositiveInt(ctx.params?.id);
		if (!paymentId) {
			return ctx.badRequest('payment id is invalid');
		}

		try {
			const relationMode = await detectFeeItemRelationMode();
			const paymentResult = await strapi.db.connection.raw(
				`
					SELECT
						p.id,
						learner.id AS learner_id,
						COALESCE(NULLIF(learner.full_name, ''), NULLIF(learner.code, ''), 'Learner #' || learner.id::text) AS learner_name,
						COALESCE(p.amount, 0) AS amount,
						p.payment_date,
						COALESCE(p.method, 'cash') AS method,
						COALESCE(p.note, '') AS note
					FROM payments p
					INNER JOIN payments_learner_lnk learner_link
						ON learner_link.payment_id = p.id
					INNER JOIN learners learner
						ON learner.id = learner_link.learner_id
					INNER JOIN payments_tenant_lnk tenant_link
						ON tenant_link.payment_id = p.id
					WHERE p.id = ? AND tenant_link.tenant_id = ?
					LIMIT 1
				`,
				[paymentId, tenantId],
			);

			const paymentRow = (paymentResult as any)?.rows?.[0];
			if (!paymentRow) {
				return ctx.notFound('Payment not found');
			}

			const allocationJoinSql = buildAllocationJoinSql(relationMode);
			const allocationsResult = await strapi.db.connection.raw(
				`
					SELECT
						allocation.id,
						COALESCE(allocation.amount, 0) AS allocation_amount,
						fee_item.id AS fee_item_id,
						COALESCE(NULLIF(fee_item.learner_name_snapshot, ''), 'Fee item #' || fee_item.id::text) AS fee_item_learner_name,
						COALESCE(class_entity.name, '') AS class_name,
						COALESCE(fee_sheet.name, '') AS fee_sheet_name,
						COALESCE(fee_item.amount, 0) AS fee_item_amount,
						COALESCE(fee_item.paid_amount, 0) AS fee_item_paid_amount,
						GREATEST(COALESCE(fee_item.amount, 0) - COALESCE(fee_item.paid_amount, 0), 0) AS fee_item_remaining,
						COALESCE(fee_item.status, 'unpaid') AS fee_item_status
					${allocationJoinSql}
					WHERE allocation_payment_link.payment_id = ?
						AND allocation_tenant_link.tenant_id = ?
					ORDER BY allocation.id DESC
				`,
				[paymentId, tenantId],
			);

			const allocationRows = Array.isArray((allocationsResult as any)?.rows) ? (allocationsResult as any).rows : [];
			const allocations = allocationRows.map(normalizeAllocationRow);
			const allocatedAmount = allocations.reduce((sum, item) => sum + toMoney(item.amount), 0);

			ctx.body = {
				data: {
					id: paymentRow.id,
					learner: {
						id: paymentRow.learner_id,
						name: paymentRow.learner_name || '',
					},
					amount: toMoney(paymentRow.amount),
					paymentDate: paymentRow.payment_date,
					method: paymentRow.method || 'cash',
					note: paymentRow.note || '',
					allocatedAmount,
					unallocatedAmount: Math.max(0, toMoney(paymentRow.amount) - allocatedAmount),
					allocations,
				},
			};
		} catch (error: any) {
			return ctx.badRequest(error?.message || 'Failed to load payment detail');
		}
	},
};