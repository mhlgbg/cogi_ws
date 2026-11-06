import crypto from 'node:crypto'

const TREE_UID = 'api::structured-tree.structured-tree'
const NODE_UID = 'api::structured-node.structured-node'
const NODE_TYPE_UID = 'api::structured-node-type.structured-node-type'
const BATCH_UID = 'api::structured-import-batch.structured-import-batch'
const ITEM_LOG_UID = 'api::structured-import-item-log.structured-import-item-log'

const PREVIEW_STORE = (globalThis as any).__cogiStructuredImportPreviewStore || ((globalThis as any).__cogiStructuredImportPreviewStore = new Map())

function normalizeKey(value: any): string {
  if (!value) return ''
  return String(value).trim().replace(/\s+/g, ' ')
}

function computeHash(data: any): string {
  return crypto.createHash('sha256').update(JSON.stringify(data ?? null)).digest('hex')
}

function sortImportNodesByParentDepth(nodes: any[]): any[] {
  const parentMap = new Map<string, string | null>()
  for (const node of nodes) {
    const keyCode = normalizeKey(node?.keyCode)
    if (!keyCode) continue
    parentMap.set(keyCode, normalizeKey(node?.parentKeyCode) || null)
  }

  const depthCache = new Map<string, number>()
  const getDepth = (keyCode: string, visited = new Set<string>()): number => {
    if (depthCache.has(keyCode)) return depthCache.get(keyCode)!
    if (visited.has(keyCode)) return 0

    const parentKeyCode = parentMap.get(keyCode)
    if (!parentKeyCode) {
      depthCache.set(keyCode, 0)
      return 0
    }

    visited.add(keyCode)
    const depth = 1 + getDepth(parentKeyCode, visited)
    depthCache.set(keyCode, depth)
    return depth
  }

  return [...nodes].sort((a: any, b: any) => {
    const aKey = normalizeKey(a?.keyCode)
    const bKey = normalizeKey(b?.keyCode)
    return (aKey ? getDepth(aKey) : 0) - (bKey ? getDepth(bKey) : 0)
  })
}

async function resolveNodeType(typeCode: string, trx?: any): Promise<number | null> {
  const normalized = normalizeKey(typeCode)
  if (!normalized) return null

  const nodeType = await (strapi.db.query(NODE_TYPE_UID) as any).findOne({
    where: { typeCode: normalized },
    select: ['id'],
    transacting: trx,
  })

  return nodeType?.id ? Number(nodeType.id) : null
}

async function findExistingNode(treeId: any, keyCode: any, trx?: any): Promise<any> {
  const normalized = normalizeKey(keyCode)
  if (!normalized) return null

  return (strapi.db.query(NODE_UID) as any).findOne({
    where: { tree: treeId, keyCode: normalized },
    select: ['id', 'keyCode', 'title', 'body', 'requirement', 'criterion', 'sortOrder', 'metadata'],
    populate: { parent: { select: ['id', 'keyCode'] }, nodeType: { select: ['id', 'typeCode'] } },
    transacting: trx,
  })
}

async function resolveParentNode(treeId: any, parentKeyCode: any, trx?: any): Promise<any> {
  if (!parentKeyCode) return null

  const normalized = normalizeKey(parentKeyCode)
  if (!normalized) return null

  const parent = await (strapi.db.query(NODE_UID) as any).findOne({
    where: { tree: treeId, keyCode: normalized },
    select: ['id'],
    transacting: trx,
  })

  return parent?.id || null
}

function compareNodeData(existing: any, imported: any): boolean {
  const existingSnapshot = {
    title: existing.title || '',
    body: existing.body || '',
    requirement: existing.requirement || null,
    criterion: existing.criterion || null,
    metadata: existing.metadata || null,
    parentId: (existing as any).parent?.id || null,
    sortOrder: existing.sortOrder || 0,
  }

  const importedSnapshot = {
    title: imported.title || '',
    body: imported.body || '',
    requirement: imported.requirement || null,
    criterion: imported.criterion || null,
    metadata: imported.metadata || null,
    parentId: imported.parentId || null,
    sortOrder: imported.sortOrder || 0,
  }

  return computeHash(existingSnapshot) === computeHash(importedSnapshot)
}

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

export default {
  async confirm(ctx: any) {
    const { previewId, batchCode } = ctx.request.body

    if (!previewId || !batchCode) {
      return ctx.badRequest('previewId and batchCode are required')
    }

    try {
      const preview = PREVIEW_STORE.get(previewId)

      if (!preview) {
        return ctx.badRequest('Preview not found or expired')
      }

      if (new Date((preview as any).expiresAt) < new Date()) {
        PREVIEW_STORE.delete(previewId)
        return ctx.badRequest('Preview expired')
      }

      const { treeId, nodes: importNodes, summary, snapshotHash } = preview as any
      const currentSnapshotHash = await computeTreeSnapshotHash(treeId)

      if (snapshotHash !== currentSnapshotHash) {
        PREVIEW_STORE.delete(previewId)
        return ctx.badRequest('Preview is stale because underlying tree data changed after preview creation')
      }

      const tree = await (strapi.entityService as any).findOne(TREE_UID, treeId, { fields: ['id'] })
      if (!tree) {
        return ctx.notFound('Tree not found')
      }

      const batchCodeExists = await strapi.db.query(BATCH_UID).findOne({
        where: { batchCode },
        select: ['id'],
      })

      if (batchCodeExists) {
        return ctx.badRequest(`Batch code "${batchCode}" already exists`)
      }

      const transactionResult = await strapi.db.transaction(async ({ trx }: any) => {
        const operationLog: any[] = []
        const errors: any[] = []
        let conflictFound = false
        const orderedImportNodes = sortImportNodesByParentDepth(importNodes)

        for (const importNode of orderedImportNodes) {
          const typeId = await resolveNodeType(importNode.nodeTypeCode, trx)
          if (!typeId) {
            errors.push({
              keyCode: importNode.keyCode,
              error: `Node type "${importNode.nodeTypeCode}" not found`,
            })
            conflictFound = true
            continue
          }

          const existingNode = await findExistingNode(treeId, importNode.keyCode, trx)
          let operation = 'created'
          let nodeId = null

          if (existingNode) {
            const isSame = compareNodeData(existingNode, {
              title: importNode.title,
              body: importNode.body,
              requirement: importNode.requirement,
              criterion: importNode.criterion,
              parentId: await resolveParentNode(treeId, importNode.parentKeyCode, trx),
              sortOrder: importNode.sortOrder || 0,
            })

            operation = isSame ? 'unchanged' : 'updated'
            nodeId = existingNode.id

            if (operation === 'updated') {
              const parentId = importNode.parentKeyCode ? await resolveParentNode(treeId, importNode.parentKeyCode, trx) : null
              const nextMetadata = {
                ...(existingNode.metadata || {}),
                ...(importNode.metadata && typeof importNode.metadata === 'object' ? importNode.metadata : {}),
              }
              if (importNode.sourceReference !== undefined) {
                nextMetadata.sourceReference = importNode.sourceReference || null
              }

              await strapi.db.query(NODE_UID).update({
                where: { id: nodeId },
                data: {
                  title: importNode.title || existingNode.title,
                  body: importNode.body !== undefined ? importNode.body : existingNode.body,
                  requirement: importNode.requirement !== undefined ? importNode.requirement : existingNode.requirement,
                  criterion: importNode.criterion !== undefined ? importNode.criterion : existingNode.criterion,
                  metadata: Object.keys(nextMetadata).length > 0 ? nextMetadata : null,
                  parent: parentId !== undefined ? parentId : ((existingNode as any).parent?.id || null),
                  sortOrder: importNode.sortOrder !== undefined ? importNode.sortOrder : existingNode.sortOrder,
                },
                transacting: trx,
              } as any)
            }
          } else {
            const parentId = importNode.parentKeyCode ? await resolveParentNode(treeId, importNode.parentKeyCode, trx) : null
            const nextMetadata = (() => {
              if (importNode.metadata && typeof importNode.metadata === 'object' && !Array.isArray(importNode.metadata)) {
                return { ...importNode.metadata }
              }
              return {}
            })()
            if (importNode.sourceReference) {
              nextMetadata.sourceReference = importNode.sourceReference
            }

            const createdNode = await strapi.db.query(NODE_UID).create({
              data: {
                tree: treeId,
                keyCode: normalizeKey(importNode.keyCode),
                nodeType: typeId,
                parent: parentId,
                title: importNode.title || '',
                body: importNode.body,
                requirement: importNode.requirement,
                criterion: importNode.criterion,
                metadata: Object.keys(nextMetadata).length > 0 ? nextMetadata : null,
                sortOrder: importNode.sortOrder || 0,
                status: 'draft',
              },
              transacting: trx,
            } as any)

            nodeId = (createdNode as any).id
          }

          operationLog.push({
            keyCode: importNode.keyCode,
            nodeId,
            operation,
          })
        }

        if (errors.length > 0 || (summary as any)?.conflicts > 0 || conflictFound) {
          throw new Error('Structured tree import conflict')
        }

        const batch = await strapi.db.query(BATCH_UID).create({
          data: {
            batchCode,
            tree: treeId,
            fileHash: (preview as any).payloadHash,
            fileName: `import-${Date.now()}.json`,
            status: 'completed',
            summary: JSON.stringify({
              ...(summary || {}),
              operationLog,
              errors,
            }),
            executedBy: (ctx.state as any).user?.id || null,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          },
          transacting: trx,
        } as any)

        return { batch, operationLog, errors }
      })

      PREVIEW_STORE.delete(previewId)

      ctx.body = {
        batchId: (transactionResult.batch as any).id,
        batchCode: (transactionResult.batch as any).batchCode,
        status: 'completed',
        summary: {
          ...(summary || {}),
          operationCount: transactionResult.operationLog.length,
          operations: transactionResult.operationLog,
        },
      }
    } catch (error: any) {
      strapi.log?.error?.('[structured-import-confirm]', error)

      if (String(error.message).includes('Structured tree import conflict')) {
        return ctx.badRequest({
          message: 'Cannot confirm import due to conflicts',
          errors: [],
        })
      }

      ctx.internalServerError({
        message: 'Confirm failed',
        error: error.message,
      })
    }
  },

  async getBatchStatus(ctx: any) {
    const { batchId } = ctx.params

    try {
      const batch = await (strapi.entityService as any).findOne(BATCH_UID, batchId, {
        populate: ['tree', 'executedBy'],
      })

      if (!batch) {
        return ctx.notFound('Batch not found')
      }

      ctx.body = batch
    } catch (error: any) {
      ctx.internalServerError(error.message)
    }
  },

  async listBatches(ctx: any) {
    const { treeId, status, limit = 25, offset = 0 } = ctx.query

    try {
      const filters: Record<string, any> = {}
      if (treeId) filters.tree = treeId
      if (status) filters.status = status

      const [batches, total] = await Promise.all([
        strapi.db.query(BATCH_UID).findMany({
          where: filters,
          orderBy: { createdAt: 'desc' },
          limit: Math.min(parseInt(limit), 100),
          offset: parseInt(offset),
          populate: { tree: { select: ['id', 'treeCode'] }, executedBy: { select: ['id', 'username', 'email'] } },
        }),
        strapi.db.query(BATCH_UID).count({ where: filters }),
      ])

      ctx.body = {
        data: batches,
        pagination: { limit: parseInt(limit), offset: parseInt(offset), total },
      }
    } catch (error: any) {
      ctx.internalServerError(error.message)
    }
  },
}
