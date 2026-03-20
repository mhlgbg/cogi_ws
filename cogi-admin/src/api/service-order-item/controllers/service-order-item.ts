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
import {
	assertDepartmentInScope,
	assertEmployeeSelf,
	getOrderUpdateLevel,
	hasOrderUpdateOverride,
	isOrderEditableState,
	resolveCurrentUserScope,
} from '../../service-order/services/service-sales-access';

const SERVICE_ORDER_ITEM_UID = 'api::service-order-item.service-order-item';
const SERVICE_ORDER_UID = 'api::service-order.service-order';
const SERVICE_ITEM_UID = 'api::service-item.service-item';

type GenericRecord = Record<string, unknown>;

function getRelationId(value: any): number | null {
	if (!value) return null;
	if (typeof value === 'number') return value > 0 ? value : null;
	if (typeof value === 'string') {
		const parsed = Number(value);
		return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
	}
	const parsed = Number(value.id);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function resolveRequestData(ctx: any): GenericRecord {
	const body = (ctx.request.body ??= {});
	if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
		body.data = {};
	}

	return body.data as GenericRecord;
}

async function validateItemRelationsInTenant(data: GenericRecord, tenantId: number | string, ctx: any) {
	const order = await findEntityByRef(SERVICE_ORDER_UID, data.order, {
		tenant: { select: ['id', 'documentId'] },
		department: { select: ['id', 'documentId'] },
		assignedEmployee: { select: ['id', 'documentId'] },
	});
	assertEntityTenantMatch(order, tenantId, 'Selected order does not belong to current tenant', ctx);

	if (data.serviceItem !== undefined && data.serviceItem !== null) {
		const serviceItem = await findEntityByRef(SERVICE_ITEM_UID, data.serviceItem, {
			tenant: { select: ['id', 'documentId'] },
		});
		assertEntityTenantMatch(serviceItem, tenantId, 'Selected service item does not belong to current tenant', ctx);
	}

	return order;
}

export default factories.createCoreController(SERVICE_ORDER_ITEM_UID, () => ({
	async find(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const query = (ctx.query || {}) as Record<string, unknown>;
		const page = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.page, 1);
		const pageSize = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.pageSize, 10);
		const start = (page - 1) * pageSize;
		const where = mergeTenantWhere(query.filters, tenantId);
		const orderBy = normalizeSortInput(query.sort);
		const populate = normalizePopulateInput(query.populate);

		const [rows, total] = await Promise.all([
			strapi.db.query(SERVICE_ORDER_ITEM_UID).findMany({
				where,
				orderBy: orderBy.length > 0 ? orderBy : undefined,
				offset: start,
				limit: pageSize,
				populate,
			}),
			strapi.db.query(SERVICE_ORDER_ITEM_UID).count({ where }),
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
		const entity = await strapi.db.query(SERVICE_ORDER_ITEM_UID).findOne({
			where: mergeTenantWhere(whereByParam(ctx.params?.id), tenantId),
			populate: normalizePopulateInput(ctx.query?.populate),
		});

		if (!entity) {
			return ctx.notFound('Service order item not found');
		}

		return this.transformResponse(entity);
	},

	async create(ctx) {
		const scope = await resolveCurrentUserScope(ctx);
		const updateLevel = getOrderUpdateLevel(scope);
		const canOverrideOwnRestriction = hasOrderUpdateOverride(scope);
		if (updateLevel === 'NONE') {
			return ctx.forbidden('You do not have permission to edit this order');
		}

		const tenantId = resolveCurrentTenantId(ctx);
		const data = resolveRequestData(ctx);
		const order = await validateItemRelationsInTenant(data, tenantId, ctx);

		if (!isOrderEditableState(order)) {
			return ctx.forbidden('Order is locked or finalized and cannot be edited');
		}

		const orderDepartmentId = getRelationId(order?.department);
		const orderAssignedEmployeeId = getRelationId(order?.assignedEmployee);

		assertDepartmentInScope(
			{
				departmentId: orderDepartmentId,
				level: updateLevel,
				scope,
			},
			ctx,
			'You do not have permission to edit items in this department'
		);

		if (!canOverrideOwnRestriction && updateLevel !== 'ALL') {
			assertEmployeeSelf(
				{
					employeeId: orderAssignedEmployeeId,
					level: 'SELF',
					scope,
				},
				ctx,
				'You can only edit your own orders'
			);
		}

		data.tenant = order?.tenant?.id || tenantId;

		const created = await strapi.db.query(SERVICE_ORDER_ITEM_UID).create({ data });
		const populatedCreated = await strapi.db.query(SERVICE_ORDER_ITEM_UID).findOne({
			where: { id: created.id },
			populate: normalizePopulateInput(ctx.query?.populate),
		});

		return this.transformResponse(populatedCreated ?? created);
	},

	async update(ctx) {
		const scope = await resolveCurrentUserScope(ctx);
		const updateLevel = getOrderUpdateLevel(scope);
		const canOverrideOwnRestriction = hasOrderUpdateOverride(scope);
		if (updateLevel === 'NONE') {
			return ctx.forbidden('You do not have permission to edit this order');
		}

		const tenantId = resolveCurrentTenantId(ctx);
		const existing = await strapi.db.query(SERVICE_ORDER_ITEM_UID).findOne({
			where: mergeTenantWhere(whereByParam(ctx.params?.id), tenantId),
			populate: ['order', 'order.department', 'order.assignedEmployee'],
		});

		if (!existing) {
			return ctx.notFound('Service order item not found');
		}

		const data = resolveRequestData(ctx);
		if (!Object.prototype.hasOwnProperty.call(data, 'order')) {
			data.order = existing.order?.id || existing.order;
		}

		const order = await validateItemRelationsInTenant(data, tenantId, ctx);

		if (!isOrderEditableState(order)) {
			return ctx.forbidden('Order is locked or finalized and cannot be edited');
		}

		const orderDepartmentId = getRelationId(order?.department);
		const orderAssignedEmployeeId = getRelationId(order?.assignedEmployee);

		assertDepartmentInScope(
			{
				departmentId: orderDepartmentId,
				level: updateLevel,
				scope,
			},
			ctx,
			'You do not have permission to edit items in this department'
		);

		if (!canOverrideOwnRestriction && updateLevel !== 'ALL') {
			assertEmployeeSelf(
				{
					employeeId: orderAssignedEmployeeId,
					level: 'SELF',
					scope,
				},
				ctx,
				'You can only edit your own orders'
			);
		}

		data.tenant = order?.tenant?.id || tenantId;

		const updated = await strapi.db.query(SERVICE_ORDER_ITEM_UID).update({
			where: { id: existing.id },
			data,
		});
		const populatedUpdated = await strapi.db.query(SERVICE_ORDER_ITEM_UID).findOne({
			where: { id: existing.id },
			populate: normalizePopulateInput(ctx.query?.populate),
		});

		return this.transformResponse(populatedUpdated ?? updated);
	},

	async delete(ctx) {
		const scope = await resolveCurrentUserScope(ctx);
		const updateLevel = getOrderUpdateLevel(scope);
		const canOverrideOwnRestriction = hasOrderUpdateOverride(scope);
		if (updateLevel === 'NONE') {
			return ctx.forbidden('You do not have permission to edit this order');
		}

		const tenantId = resolveCurrentTenantId(ctx);
		const existing = await strapi.db.query(SERVICE_ORDER_ITEM_UID).findOne({
			where: mergeTenantWhere(whereByParam(ctx.params?.id), tenantId),
			populate: ['order', 'order.department', 'order.assignedEmployee'],
		});

		if (!existing) {
			return ctx.notFound('Service order item not found');
		}

		const order = existing?.order;
		if (!isOrderEditableState(order)) {
			return ctx.forbidden('Order is locked or finalized and cannot be edited');
		}

		const orderDepartmentId = getRelationId(order?.department);
		const orderAssignedEmployeeId = getRelationId(order?.assignedEmployee);

		assertDepartmentInScope(
			{
				departmentId: orderDepartmentId,
				level: updateLevel,
				scope,
			},
			ctx,
			'You do not have permission to edit items in this department'
		);

		if (!canOverrideOwnRestriction && updateLevel !== 'ALL') {
			assertEmployeeSelf(
				{
					employeeId: orderAssignedEmployeeId,
					level: 'SELF',
					scope,
				},
				ctx,
				'You can only edit your own orders'
			);
		}

		return await super.delete({
			...ctx,
			params: { ...ctx.params, id: existing.id },
		});
	},
}));
