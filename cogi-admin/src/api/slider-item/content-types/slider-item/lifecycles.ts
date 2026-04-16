import { errors } from '@strapi/utils';
import { extractRelationRef, hasOwn, toText } from '../../../../utils/tenant-scope';

const SLIDER_ITEM_UID = 'api::slider-item.slider-item';
const SLIDER_UID = 'api::slider.slider';

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

async function loadExistingSliderItem(where: unknown) {
	const normalizedWhere = typeof where === 'object' && where !== null
		? Object.fromEntries(
			Object.entries(where as Record<string, unknown>).filter(
				([key, value]) => !(key === 'locale' && (value === '' || value === null)),
			),
		)
		: where;

	if (!normalizedWhere) return null;

	return strapi.db.query(SLIDER_ITEM_UID).findOne({
		where: normalizedWhere,
		populate: {
			slider: { populate: { tenant: { select: ['id', 'documentId'] } } },
		},
	});
}

async function ensureSliderItemIsValid(params: { data?: GenericRecord; where?: unknown }) {
	const data = (params.data || {}) as GenericRecord;
	const existing = await loadExistingSliderItem(params.where);
	const requestTenantId = getRequestContextTenantId();

	const sliderRef = extractRelationRef(data.slider) || extractEntryRelationRef(existing?.slider);
	if (!sliderRef) {
		throw new errors.ApplicationError('slider is required');
	}

	const slider = await strapi.db.query(SLIDER_UID).findOne({
		where: { id: sliderRef },
		populate: { tenant: { select: ['id', 'documentId'] } },
	});

	if (!slider?.id) {
		throw new errors.ApplicationError('slider is invalid');
	}

	const sliderTenantRef = extractEntryRelationRef(slider?.tenant);
	if (!sliderTenantRef) {
		throw new errors.ApplicationError('slider tenant is missing');
	}

	if (requestTenantId && String(sliderTenantRef) !== String(requestTenantId)) {
		throw new errors.ApplicationError('slider does not belong to the current tenant');
	}

	const title = hasOwn(data, 'title') ? toText(data.title) : toText(existing?.title);
	const description = hasOwn(data, 'description') ? toText(data.description) : toText(existing?.description);
	const link = hasOwn(data, 'link') ? toText(data.link) : toText(existing?.link);
	const orderRaw = hasOwn(data, 'order') ? data.order : existing?.order;
	const showTitle = hasOwn(data, 'showTitle') ? Boolean(data.showTitle) : Boolean(existing?.showTitle ?? true);
	const showDescription = hasOwn(data, 'showDescription') ? Boolean(data.showDescription) : Boolean(existing?.showDescription ?? true);
	const openInNewTab = hasOwn(data, 'openInNewTab') ? Boolean(data.openInNewTab) : Boolean(existing?.openInNewTab ?? false);
	const isActive = hasOwn(data, 'isActive') ? Boolean(data.isActive) : Boolean(existing?.isActive ?? true);

	let order = 0;
	if (orderRaw !== undefined && orderRaw !== null && orderRaw !== '') {
		const parsedOrder = Number(orderRaw);
		if (!Number.isFinite(parsedOrder)) {
			throw new errors.ApplicationError('order must be a number');
		}
		order = Math.floor(parsedOrder);
	}

	data.slider = sliderRef;
	data.title = title || null;
	data.description = description || null;
	data.link = link || null;
	data.order = order;
	data.showTitle = showTitle;
	data.showDescription = showDescription;
	data.openInNewTab = openInNewTab;
	data.isActive = isActive;
}

export default {
	async beforeCreate(event: any) {
		await ensureSliderItemIsValid({ data: event.params?.data });
	},

	async beforeUpdate(event: any) {
		await ensureSliderItemIsValid({
			data: event.params?.data,
			where: event.params?.where,
		});
	},
};