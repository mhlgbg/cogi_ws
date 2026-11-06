const NODE_UID = 'api::structured-node.structured-node'
const TREE_UID = 'api::structured-tree.structured-tree'
const NODE_TYPE_UID = 'api::structured-node-type.structured-node-type'

function normalizeKey(value: any): string {
  if (!value) return ''
  return String(value).trim().replace(/\s+/g, ' ')
}

/**
 * Detects if adding parentId to nodeId would create a cycle in the tree.
 * Returns { hasCycle: boolean, cycle: string[] } if cycle detected, { hasCycle: false } otherwise.
 */
async function detectCycle(treeId: number, nodeId: any, parentId: any): Promise<any> {
  if (!parentId || parentId === nodeId) {
    return { hasCycle: false }
  }

  const visited = new Set()
  let current = parentId

  while (current) {
    if (visited.has(current)) {
      return {
        hasCycle: true,
        cycle: [nodeId, ...Array.from(visited)],
      }
    }

    visited.add(current)

    const parent = await strapi.db.query(NODE_UID).findOne({
      where: { id: current, tree: treeId },
      select: ['id', 'parent'],
      populate: { parent: { select: ['id'] } },
    })

    current = parent?.parent?.id || null
  }

  return { hasCycle: false }
}

/**
 * Checks uniqueness constraint: (tree, keyCode) composite key
 */
async function checkKeyCodeUniqueness(treeId: any, keyCode: any, excludeNodeId: any = null): Promise<boolean> {
  const where: Record<string, any> = {
    tree: treeId,
    keyCode: normalizeKey(keyCode),
  }

  if (excludeNodeId) {
    const existing = await strapi.db.query(NODE_UID).findMany({
      where: { tree: treeId, keyCode: normalizeKey(keyCode) },
      select: ['id'],
    })
    return existing.filter((n: any) => n.id !== excludeNodeId).length > 0
  }

  const count = await strapi.db.query(NODE_UID).count({ where })
  return count > 0
}

export default {
  async create(ctx: any) {
    const { treeId } = ctx.params
    const { keyCode, nodeTypeId, parentId, title, body, requirement, criterion, sortOrder, metadata, sourceReference } = ctx.request.body

    if (!keyCode || !nodeTypeId) {
      return ctx.badRequest('keyCode and nodeTypeId are required')
    }

    const currentMetadata = (() => {
      if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
        return { ...metadata }
      }
      return {}
    })()

    if (sourceReference) {
      currentMetadata.sourceReference = sourceReference
    }

    try {
      const tree = await (strapi.entityService as any).findOne(TREE_UID, treeId, { fields: ['id'] })
      if (!tree) {
        return ctx.notFound('Tree not found')
      }

      const keyExists = await checkKeyCodeUniqueness(treeId, keyCode)
      if (keyExists) {
        return ctx.badRequest(`Node with keyCode "${keyCode}" already exists in this tree`)
      }

      const nodeType = await (strapi.entityService as any).findOne(NODE_TYPE_UID, nodeTypeId, { fields: ['id'] })
      if (!nodeType) {
        return ctx.badRequest('Node type not found')
      }

      if (parentId) {
        const cycleCheck = await detectCycle(treeId, null, parentId)
        if (cycleCheck.hasCycle) {
          return ctx.badRequest('Setting this parent would create a cycle in the tree')
        }
      }

      const node = await (strapi.entityService as any).create(NODE_UID, {
        data: {
          tree: treeId,
          keyCode: normalizeKey(keyCode),
          nodeType: nodeTypeId,
          parent: parentId || null,
          title: title ? title.trim() : '',
          body,
          requirement,
          criterion,
          metadata: Object.keys(currentMetadata).length > 0 ? currentMetadata : null,
          sortOrder: sortOrder || 0,
          status: 'draft',
        },
      })

      ctx.created(node)
    } catch (error: any) {
      ctx.internalServerError(error.message)
    }
  },

  async find(ctx: any) {
    const { treeId } = ctx.params
    const { parentId, nodeTypeId, status, limit = 50, offset = 0 } = ctx.query

    try {
      const tree = await (strapi.entityService as any).findOne(TREE_UID, treeId, { fields: ['id'] })
      if (!tree) {
        return ctx.notFound('Tree not found')
      }

      const filters: Record<string, any> = { tree: treeId }
      if (parentId) filters.parent = parentId === 'null' ? null : parseInt(parentId)
      if (nodeTypeId) filters.nodeType = nodeTypeId
      if (status) filters.status = status

      const [nodes, total] = await Promise.all([
        strapi.db.query(NODE_UID).findMany({
          where: filters,
          orderBy: { sortOrder: 'asc', createdAt: 'asc' },
          limit: Math.min(parseInt(limit), 100),
          offset: parseInt(offset),
          populate: { parent: { select: ['id', 'keyCode'] }, nodeType: { select: ['id', 'typeCode'] } },
        }),
        strapi.db.query(NODE_UID).count({ where: filters }),
      ])

      ctx.body = {
        data: nodes,
        pagination: { limit: parseInt(limit), offset: parseInt(offset), total },
      }
    } catch (error: any) {
      ctx.internalServerError(error.message)
    }
  },

  async findOne(ctx: any) {
    const { treeId, nodeId } = ctx.params

    try {
      const node = await (strapi.entityService as any).findOne(NODE_UID, nodeId, {
        populate: {
          tree: { select: ['id', 'treeCode'] },
          nodeType: { select: ['id', 'typeCode'] },
          parent: { select: ['id', 'keyCode', 'title'] },
          children: { select: ['id', 'keyCode', 'title', 'sortOrder'] },
        },
      })

      if (!node || (node as any).tree?.id !== parseInt(treeId)) {
        return ctx.notFound('Node not found')
      }

      ctx.body = node
    } catch (error: any) {
      ctx.internalServerError(error.message)
    }
  },

  async update(ctx: any) {
    const { treeId, nodeId } = ctx.params
    const { title, body, requirement, criterion, parentId, sortOrder, status, metadata, sourceReference } = ctx.request.body

    try {
      const node = await (strapi.entityService as any).findOne(NODE_UID, nodeId, {
        populate: { tree: { select: ['id'] } },
      })

      if (!node || (node as any).tree?.id !== parseInt(treeId)) {
        return ctx.notFound('Node not found')
      }

      const updateData: Record<string, any> = {}
      const nextMetadata = (() => {
        if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
          return { ...(node.metadata || {}), ...metadata }
        }
        return { ...(node.metadata || {}) }
      })()

      if (title !== undefined) updateData.title = title.trim()
      if (body !== undefined) updateData.body = body
      if (requirement !== undefined) updateData.requirement = requirement
      if (criterion !== undefined) updateData.criterion = criterion
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder
      if (status !== undefined) updateData.status = status
      if (sourceReference !== undefined) {
        nextMetadata.sourceReference = sourceReference || null
      }
      if (metadata !== undefined || sourceReference !== undefined) {
        updateData.metadata = Object.keys(nextMetadata).length > 0 ? nextMetadata : null
      }

      if (parentId !== undefined) {
        if (parentId === null || parentId === 'null') {
          updateData.parent = null
        } else {
          const cycleCheck = await detectCycle(treeId, nodeId, parentId)
          if (cycleCheck.hasCycle) {
            return ctx.badRequest('Setting this parent would create a cycle in the tree')
          }
          updateData.parent = parentId
        }
      }

      const updated = await (strapi.entityService as any).update(NODE_UID, nodeId, { data: updateData })

      ctx.body = updated
    } catch (error: any) {
      ctx.internalServerError(error.message)
    }
  },

  async delete(ctx: any) {
    const { treeId, nodeId } = ctx.params

    try {
      const node = await (strapi.entityService as any).findOne(NODE_UID, nodeId, {
        populate: { tree: { select: ['id'] } },
      })

      if (!node || (node as any).tree?.id !== parseInt(treeId)) {
        return ctx.notFound('Node not found')
      }

      await (strapi.entityService as any).update(NODE_UID, nodeId, {
        data: { status: 'archived' },
      })

      ctx.body = { message: 'Node archived successfully' }
    } catch (error: any) {
      ctx.internalServerError(error.message)
    }
  },

  async hierarchy(ctx: any) {
    const { treeId } = ctx.params

    try {
      const tree = await (strapi.entityService as any).findOne(TREE_UID, treeId, { fields: ['id'] })
      if (!tree) {
        return ctx.notFound('Tree not found')
      }

      const allNodes = await strapi.db.query(NODE_UID).findMany({
        where: {
          tree: treeId,
          status: { $ne: 'archived' },
        },
        populate: {
          nodeType: { select: ['id', 'typeCode'] },
          parent: { select: ['id', 'keyCode'] },
        },
      })

      const nodeById = new Map<number, any>()
      const childrenByParentId = new Map<number | null, any[]>()

      for (const node of allNodes) {
        nodeById.set(Number(node.id), node)
        const parentId = node?.parent?.id ? Number(node.parent.id) : null
        const siblings = childrenByParentId.get(parentId) || []
        siblings.push(node)
        childrenByParentId.set(parentId, siblings)
      }

      for (const siblings of childrenByParentId.values()) {
        siblings.sort((a: any, b: any) => {
          const sortDiff = Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
          if (sortDiff !== 0) return sortDiff
          return Number(a.id) - Number(b.id)
        })
      }

      const visited = new Set<number>()
      const cycleEdgeIds = new Set<number>()

      const buildHierarchy = (parentId: number | null = null, depth: number = 0, ancestry = new Set<number>()): any[] => {
        const children = childrenByParentId.get(parentId) || []

        return children.map((node: any) => {
          const nodeId = Number(node.id)
          const nextAncestry = new Set(ancestry)
          if (nextAncestry.has(nodeId)) {
            cycleEdgeIds.add(nodeId)
            return {
              id: node.id,
              keyCode: node.keyCode,
              title: node.title,
              nodeType: node.nodeType,
              sortOrder: node.sortOrder,
              status: node.status,
              depth,
              children: [],
            }
          }

          nextAncestry.add(nodeId)
          visited.add(nodeId)

          return {
            id: node.id,
            keyCode: node.keyCode,
            title: node.title,
            nodeType: node.nodeType,
            sortOrder: node.sortOrder,
            status: node.status,
            depth,
            children: buildHierarchy(nodeId, depth + 1, nextAncestry),
          }
        })
      }

      const hierarchy = buildHierarchy()
      const orphanNodes = allNodes
        .filter((node: any) => {
          const nodeId = Number(node.id)
          if (!node?.parent?.id) return false
          if (cycleEdgeIds.has(nodeId)) return true
          if (!nodeById.has(Number(node.parent.id))) return true
          return !visited.has(nodeId)
        })
        .map((node: any) => ({
          id: node.id,
          keyCode: node.keyCode,
          parentKeyCode: node.parent?.keyCode || null,
          status: node.status,
        }))

      ctx.body = {
        hierarchy,
        meta: {
          totalNodes: allNodes.length,
          rootNodes: hierarchy.length,
          orphanNodes: orphanNodes.length,
        },
        orphanNodes,
      }
    } catch (error: any) {
      ctx.internalServerError(error.message)
    }
  },

  async findRequirements(ctx: any) {
    const { treeId } = ctx.params
    const { limit = 50, offset = 0 } = ctx.query

    try {
      const tree = await (strapi.entityService as any).findOne(TREE_UID, treeId, { fields: ['id'] })
      if (!tree) {
        return ctx.notFound('Tree not found')
      }

      const nodes = await strapi.db.query(NODE_UID).findMany({
        where: {
          tree: treeId,
          status: 'active',
        },
        limit: Math.min(parseInt(limit), 100),
        offset: parseInt(offset),
      })

      const requirementNodes = nodes.filter((n: any) => n.requirement && Object.keys(n.requirement).length > 0)

      ctx.body = {
        data: requirementNodes,
        pagination: { limit: parseInt(limit), offset: parseInt(offset) },
      }
    } catch (error: any) {
      ctx.internalServerError(error.message)
    }
  },

  async findCriteria(ctx: any) {
    const { treeId } = ctx.params
    const { limit = 50, offset = 0 } = ctx.query

    try {
      const tree = await (strapi.entityService as any).findOne(TREE_UID, treeId, { fields: ['id'] })
      if (!tree) {
        return ctx.notFound('Tree not found')
      }

      const nodes = await strapi.db.query(NODE_UID).findMany({
        where: {
          tree: treeId,
          status: 'active',
        },
        limit: Math.min(parseInt(limit), 100),
        offset: parseInt(offset),
      })

      const criterionNodes = nodes.filter((n: any) => n.criterion && Object.keys(n.criterion).length > 0)

      ctx.body = {
        data: criterionNodes,
        pagination: { limit: parseInt(limit), offset: parseInt(offset) },
      }
    } catch (error: any) {
      ctx.internalServerError(error.message)
    }
  },
}
