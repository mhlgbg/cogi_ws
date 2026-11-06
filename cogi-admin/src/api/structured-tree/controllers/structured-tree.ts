const TREE_UID = 'api::structured-tree.structured-tree'

export default {
  async create(ctx) {
    const { treeCode, title, description, body, status } = ctx.request.body

    if (!treeCode || !title) {
      return ctx.badRequest('treeCode and title are required')
    }

    try {
      const existing = await strapi.db.query(TREE_UID).findOne({
        where: { treeCode },
      })

      if (existing) {
        return ctx.badRequest(`Tree with treeCode "${treeCode}" already exists`)
      }

      const tree = await (strapi.entityService as any).create(TREE_UID, {
        data: {
          treeCode: treeCode.trim(),
          title: title.trim(),
          description,
          body,
          status: status || 'draft',
        },
      })

      ctx.created(tree)
    } catch (error) {
      ctx.internalServerError(error.message)
    }
  },

  async find(ctx) {
    const { status, limit = 25, offset = 0 } = ctx.query

    try {
      const filters: Record<string, any> = { }
      if (status) filters.status = status

      const [trees, total] = await Promise.all([
        strapi.db.query(TREE_UID).findMany({
          where: filters,
          orderBy: { createdAt: 'desc' },
          limit: Math.min(parseInt(limit), 100),
          offset: parseInt(offset),
        }),
        strapi.db.query(TREE_UID).count({ where: filters }),
      ])

      ctx.body = {
        data: trees,
        pagination: { limit: parseInt(limit), offset: parseInt(offset), total },
      }
    } catch (error) {
      ctx.internalServerError(error.message)
    }
  },

  async findOne(ctx) {
    const { id } = ctx.params

    try {
      const tree = await (strapi.entityService as any).findOne(TREE_UID, id, {
        populate: ['nodeTypes', 'createdBy', 'updatedBy'],
      })

      if (!tree) {
        return ctx.notFound('Tree not found')
      }

      ctx.body = tree
    } catch (error) {
      ctx.internalServerError(error.message)
    }
  },

  async update(ctx) {
    const { id } = ctx.params
    const { title, description, body, status } = ctx.request.body

    try {
      const tree = await (strapi.entityService as any).findOne(TREE_UID, id)

      if (!tree) {
        return ctx.notFound('Tree not found')
      }

      const updateData: Record<string, any> = {}
      if (title !== undefined) updateData.title = title.trim()
      if (description !== undefined) updateData.description = description
      if (body !== undefined) updateData.body = body
      if (status !== undefined) updateData.status = status

      const updated = await (strapi.entityService as any).update(TREE_UID, id, { data: updateData })

      ctx.body = updated
    } catch (error) {
      ctx.internalServerError(error.message)
    }
  },

  async delete(ctx) {
    const { id } = ctx.params

    try {
      const tree = await (strapi.entityService as any).findOne(TREE_UID, id)

      if (!tree) {
        return ctx.notFound('Tree not found')
      }

      await (strapi.entityService as any).update(TREE_UID, id, {
        data: { status: 'archived' },
      })

      ctx.body = { message: 'Tree archived successfully' }
    } catch (error) {
      ctx.internalServerError(error.message)
    }
  },
}
