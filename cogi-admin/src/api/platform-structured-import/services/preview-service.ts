import crypto from 'node:crypto'

const TREE_UID = 'api::structured-tree.structured-tree'
const NODE_UID = 'api::structured-node.structured-node'
const NODE_TYPE_UID = 'api::structured-node-type.structured-node-type'
const BATCH_UID = 'api::structured-import-batch.structured-import-batch'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_NODES = 5000
const PREVIEW_STORE = (globalThis as any).__cogiStructuredImportPreviewStore || ((globalThis as any).__cogiStructuredImportPreviewStore = new Map())
const PREVIEW_TTL_MS = 15 * 60 * 1000

async function computeTreeSnapshotHash(treeId: any): Promise<string> {
  const rows = await strapi.db.query(NODE_UID).findMany({
    where: { tree: treeId },
    select: ['id', 'keyCode', 'title', 'body', 'status', 'sortOrder', 'requirement', 'criterion', 'metadata'],
    populate: { nodeType: { select: ['id', 'typeCode'] }, parent: { select: ['id', 'keyCode'] } },
  })

  const normalized = (rows || []).map((row: any) => ({
    keyCode: normalizeKey(row.keyCode),
    nodeTypeCode: row.nodeType?.typeCode || '',
    parentKeyCode: normalizeKey(row.parent?.keyCode),
    title: row.title || '',
    body: row.body || '',
    status: row.status || 'draft',
    sortOrder: row.sortOrder || 0,
    requirement: row.requirement || null,
    criterion: row.criterion || null,
    metadata: row.metadata || null,
  })).sort((a: any, b: any) => a.keyCode.localeCompare(b.keyCode))

  return computeHash(normalized)
}

function normalizeKey(value: any): string {
  if (!value) return ''
  return String(value).trim().replace(/\s+/g, ' ')
}

function computeHash(data: any): string {
  return crypto.createHash('sha256').update(JSON.stringify(data ?? null)).digest('hex')
}

function validateNodeData(node: any): string[] {
  const errors = []
  if (!node.keyCode) errors.push('keyCode is required')
  if (!node.nodeTypeCode) errors.push('nodeTypeCode is required')
  if (node.title !== undefined && typeof node.title !== 'string') errors.push('title must be a string')
  if (node.body !== undefined && typeof node.body !== 'string') errors.push('body must be a string')
  return errors
}

async function resolveNodeType(treeId: any, typeCode: any): Promise<any> {
  const normalized = normalizeKey(typeCode)
  if (!normalized) return null

  const nodeType = await strapi.db.query(NODE_TYPE_UID).findOne({
    where: { typeCode: normalized },
    select: ['id'],
  })

  return nodeType?.id || null
}

async function findExistingNode(treeId: any, keyCode: any): Promise<any> {
  const normalized = normalizeKey(keyCode)
  if (!normalized) return null

  return strapi.db.query(NODE_UID).findOne({
    where: { tree: treeId, keyCode: normalized },
    select: ['id', 'keyCode', 'title', 'body', 'requirement', 'criterion', 'metadata', 'status', 'sortOrder'],
    populate: {
      nodeType: { select: ['id', 'typeCode'] },
      parent: { select: ['id', 'keyCode'] },
    },
  })
}

function detectCycleInNodes(nodes: any[], nodeToParentMap: Map<any, any>): any[] {
  const cycles: any[] = []

  const visitNode = (nodeId: any, visited: Set<any> = new Set(), stack: any[] = []): boolean => {
    if (visited.has(nodeId)) return false

    const parentNodeId = nodeToParentMap.get(nodeId)
    if (!parentNodeId) return false

    if (stack.includes(parentNodeId)) {
      cycles.push({
        node: nodeId,
        cycle: [...stack, parentNodeId, nodeId],
      })
      return true
    }

    visited.add(nodeId)
    visitNode(parentNodeId, visited, [...stack, nodeId])
    return false
  }

  for (const node of nodes) {
    visitNode(node.id || node.keyCode)
  }

  return cycles
}

export default {
  async preview(ctx: any) {
    const { treeId, nodes } = ctx.request.body

    if (!treeId) {
      return ctx.badRequest('treeId is required')
    }

    if (!Array.isArray(nodes) || nodes.length === 0) {
      return ctx.badRequest('nodes must be a non-empty array')
    }

    if (nodes.length > MAX_NODES) {
      return ctx.badRequest(`Exceeded maximum nodes (${MAX_NODES}). Provided: ${nodes.length}`)
    }

    try {
      const tree = await (strapi.entityService as any).findOne(TREE_UID, treeId, { fields: ['id', 'treeCode'] })
      if (!tree) {
        return ctx.notFound('Tree not found')
      }

      const payloadHash = computeHash({ treeId, nodes })
      const currentSnapshotHash = await computeTreeSnapshotHash(treeId)
      const previewId = `preview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      const validationErrors: any[] = []
      const nodeIndexMap = new Map()
      const parentRefMap = new Map()
      const summary: Record<string, any> = { new: 0, updated: 0, unchanged: 0, conflicts: 0, errors: [] }

      for (let i = 0; i < nodes.length; i++) {
        const nodeData = nodes[i]
        const idx = i + 1

        const nodeErrors = validateNodeData(nodeData)
        if (nodeErrors.length > 0) {
          validationErrors.push({
            rowNumber: idx,
            keyCode: nodeData.keyCode || 'N/A',
            errors: nodeErrors,
          })
          summary.conflicts++
          continue
        }

        const normalizedKeyCode = normalizeKey(nodeData.keyCode)
        if (nodeIndexMap.has(normalizedKeyCode)) {
          validationErrors.push({
            rowNumber: idx,
            keyCode: nodeData.keyCode,
            errors: ['Duplicate keyCode within import'],
          })
          summary.conflicts++
          continue
        }

        nodeIndexMap.set(normalizedKeyCode, { ...nodeData, rowNumber: idx })

        if (nodeData.parentKeyCode) {
          const parentKey = normalizeKey(nodeData.parentKeyCode)
          parentRefMap.set(normalizedKeyCode, parentKey)
        }
      }

      const cycleCheckResult = detectCycleInNodes(Array.from(nodeIndexMap.values()), parentRefMap)
      if (cycleCheckResult.length > 0) {
        for (const cycleInfo of cycleCheckResult) {
          validationErrors.push({
            keyCode: cycleInfo.node,
            errors: [`Cycle detected: ${cycleInfo.cycle.join(' -> ')}`],
          })
          summary.conflicts++
        }
      }

      for (const [normalizedKeyCode, nodeData] of nodeIndexMap.entries()) {
        if (validationErrors.some((e: any) => normalizeKey(e.keyCode) === normalizedKeyCode)) {
          continue
        }

        const typeId = await resolveNodeType(treeId, nodeData.nodeTypeCode)
        if (!typeId) {
          validationErrors.push({
            rowNumber: (nodeData as any).rowNumber,
            keyCode: nodeData.keyCode,
            errors: [`Node type "${nodeData.nodeTypeCode}" not found`],
          })
          summary.conflicts++
          continue
        }

        const existingNode = await findExistingNode(treeId, nodeData.keyCode)

        if (existingNode) {
          const newDataHash = computeHash({
            keyCode: normalizedKeyCode,
            nodeTypeCode: nodeData.nodeTypeCode,
            title: nodeData.title,
            body: nodeData.body,
            requirement: nodeData.requirement,
            criterion: nodeData.criterion,
            metadata: nodeData.metadata || { sourceReference: nodeData.sourceReference || null },
          })

          const existingDataHash = computeHash({
            keyCode: existingNode.keyCode,
            nodeTypeCode: (existingNode as any).nodeType?.typeCode,
            title: existingNode.title,
            body: existingNode.body,
            requirement: existingNode.requirement,
            criterion: existingNode.criterion,
            metadata: existingNode.metadata || null,
          })

          if (newDataHash === existingDataHash) {
            summary.unchanged++
          } else {
            summary.updated++
          }
        } else {
          summary.new++
        }
      }

      const preview = {
        previewId,
        treeId,
        treCode: (tree as any).treeCode,
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + PREVIEW_TTL_MS).toISOString(),
        payloadHash,
        snapshotHash: currentSnapshotHash,
        totalNodes: nodes.length,
        validationErrors,
        summary,
        nodes: Array.from(nodeIndexMap.values()),
      }

      PREVIEW_STORE.set(previewId, preview)

      ctx.body = {
        previewId,
        timestamp: preview.timestamp,
        expiresAt: preview.expiresAt,
        payloadHash,
        snapshotHash: currentSnapshotHash,
        totalNodes: nodes.length,
        summary,
        validationErrors: validationErrors.slice(0, 100),
        warnings: validationErrors.length > 100 ? `Showing first 100 errors, total: ${validationErrors.length}` : undefined,
      }
    } catch (error: any) {
      ctx.internalServerError(error.message)
    }
  },

  async getPreview(ctx: any) {
    const { previewId } = ctx.params

    try {
      const preview = PREVIEW_STORE.get(previewId)

      if (!preview) {
        return ctx.notFound('Preview not found or expired')
      }

      if (new Date(preview.expiresAt) < new Date()) {
        PREVIEW_STORE.delete(previewId)
        return ctx.notFound('Preview expired')
      }

      ctx.body = preview
    } catch (error: any) {
      ctx.internalServerError(error.message)
    }
  },
}
