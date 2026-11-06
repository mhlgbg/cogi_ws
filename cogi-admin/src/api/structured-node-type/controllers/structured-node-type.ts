const NODE_TYPE_UID = 'api::structured-node-type.structured-node-type'

function normalizeTypeCode(value: any): string {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

export default {
  async create(ctx) {
    const { typeCode, title, name, description, status, allowedParentTypes, metadata } = ctx.request.body
    const normalizedTypeCode = normalizeTypeCode(typeCode)
    const normalizedTitle = String(title ?? name ?? '').trim()

    if (!normalizedTypeCode || !normalizedTitle) {
      return ctx.badRequest('typeCode and title are required')
    }

    try {
      const existing = await strapi.db.query(NODE_TYPE_UID).findOne({
        where: { typeCode: normalizedTypeCode },
        select: ['id', 'typeCode'],
      })

      if (existing) {
        return ctx.badRequest(`Node type with typeCode "${normalizedTypeCode}" already exists`)
      }

      const nodeType = await (strapi.entityService as any).create(NODE_TYPE_UID, {
        data: {
          typeCode: normalizedTypeCode,
          title: normalizedTitle,
          description,
          status: status || 'active',
          allowedParentTypes: Array.isArray(allowedParentTypes) ? allowedParentTypes : null,
          metadata,
        },
      })

      ctx.created(nodeType)
    } catch (error) {
      if (String((error as any)?.message || '').toLowerCase().includes('duplicate')) {
        return ctx.badRequest(`Node type with typeCode "${normalizedTypeCode}" already exists`)
      }
      ctx.internalServerError((error as any)?.message || 'Create node type failed')
    }
  },

  async find(ctx) {
    const { status, limit = 25, offset = 0 } = ctx.query

    try {
      const filters: Record<string, any> = {}
      if (status) filters.status = status

      const [nodeTypes, total] = await Promise.all([
        strapi.db.query(NODE_TYPE_UID).findMany({
          where: filters,
          orderBy: { createdAt: 'desc' },
          limit: Math.min(parseInt(limit), 100),
          offset: parseInt(offset),
        }),
        strapi.db.query(NODE_TYPE_UID).count({ where: filters }),
      ])

      ctx.body = {
        data: nodeTypes,
        pagination: { limit: parseInt(limit), offset: parseInt(offset), total },
      }
    } catch (error) {
      ctx.internalServerError(error.message)
    }
  },

  async findOne(ctx) {
    const { id } = ctx.params

    try {
      const nodeType = await (strapi.entityService as any).findOne(NODE_TYPE_UID, id, {
        populate: ['trees', 'nodes'],
      })

      if (!nodeType) {
        return ctx.notFound('Node type not found')
      }

      ctx.body = nodeType
    } catch (error) {
      ctx.internalServerError(error.message)
    }
  },

  async update(ctx) {
    const { id } = ctx.params
    const { typeCode, title, name, description, status, allowedParentTypes, metadata } = ctx.request.body
    const normalizedTypeCode = typeCode ? String(typeCode).trim() : undefined
    const normalizedTitle = title !== undefined ? String(title).trim() : name !== undefined ? String(name).trim() : undefined

    try {
      const nodeType = await (strapi.entityService as any).findOne(NODE_TYPE_UID, id)

      if (!nodeType) {
        return ctx.notFound('Node type not found')
      }

      const updateData: Record<string, any> = {}
      if (normalizedTypeCode) updateData.typeCode = normalizedTypeCode
      if (normalizedTitle) updateData.title = normalizedTitle
      if (description !== undefined) updateData.description = description
      if (status !== undefined) updateData.status = status
      if (allowedParentTypes !== undefined) updateData.allowedParentTypes = allowedParentTypes
      if (metadata !== undefined) updateData.metadata = metadata

      const existingDuplicate = normalizedTypeCode
        ? await strapi.db.query(NODE_TYPE_UID).findOne({
            where: { typeCode: normalizedTypeCode },
            select: ['id'],
          })
        : null

      if (existingDuplicate && Number(existingDuplicate.id) !== Number(id)) {
        return ctx.badRequest(`Node type with typeCode "${normalizedTypeCode}" already exists`)
      }

      const updated = await (strapi.entityService as any).update(NODE_TYPE_UID, id, { data: updateData })

      ctx.body = updated
    } catch (error) {
      ctx.internalServerError((error as any)?.message || 'Update node type failed')
    }
  },

  async delete(ctx) {
    const { id } = ctx.params

    try {
      const nodeType = await (strapi.entityService as any).findOne(NODE_TYPE_UID, id, {
        populate: ['nodes'],
      })

      if (!nodeType) {
        return ctx.notFound('Node type not found')
      }

      const nodeUsageCount = Array.isArray((nodeType as any).nodes) ? (nodeType as any).nodes.length : 0
      if (nodeUsageCount > 0) {
        return ctx.badRequest('Cannot delete a node type that is currently in use by nodes')
      }

      await (strapi.entityService as any).delete(NODE_TYPE_UID, id)

      ctx.body = { message: 'Node type deleted successfully' }
    } catch (error) {
      ctx.internalServerError((error as any)?.message || 'Delete node type failed')
    }
  },
}
