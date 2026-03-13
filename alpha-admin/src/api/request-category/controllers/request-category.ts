/**
 * request-category controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::request-category.request-category', () => ({
	async find(ctx) {
		if (!ctx.state.user?.id) {
			return ctx.unauthorized('Unauthorized');
		}

		const model = strapi.getModel('api::request-category.request-category');
		const attributes = (model?.attributes || {}) as Record<string, unknown>;
		const hasOrderField = 'order' in attributes;
		const hasPublishedAtField = 'publishedAt' in attributes;

		const orderBy = hasOrderField ? [{ order: 'asc' }, { name: 'asc' }] : [{ name: 'asc' }];
		const documentSort = hasOrderField ? ['order:asc', 'name:asc'] : ['name:asc'];
		const where: Record<string, unknown> = {
			isActive: {
				$ne: false,
			},
		};

		const documentService = (strapi as any).documents?.('api::request-category.request-category');

		if (documentService?.findMany) {
			const categories = await documentService.findMany({
				status: 'published',
				filters: {
					isActive: {
						$ne: false,
					},
				},
				sort: documentSort,
			});

			ctx.body = {
				data: categories,
				meta: {
					total: categories.length,
				},
			};

			return;
		}

		if (hasPublishedAtField) {
			where.publishedAt = {
				$notNull: true,
			};
		}

		const categories = await strapi.db.query('api::request-category.request-category').findMany({
			where,
			orderBy,
		});

		ctx.body = {
			data: categories,
			meta: {
				total: categories.length,
			},
		};
	},
}));
