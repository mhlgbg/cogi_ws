import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import SimpleHtmlEditor from '../../modules/admission-management/components/SimpleHtmlEditor'
import {
  confirmStructuredImport,
  createStructuredNode,
  createStructuredNodeType,
  createStructuredTree,
  deleteStructuredNode,
  deleteStructuredNodeType,
  deleteStructuredTree,
  getApiMessage,
  getStructuredImportBatches,
  getStructuredNodeTypes,
  getStructuredTreeById,
  getStructuredTreeHierarchy,
  getStructuredTreeNodes,
  getStructuredTrees,
  previewStructuredImport,
  updateStructuredNode,
  updateStructuredNodeType,
  updateStructuredTree,
} from '../services/platformApi'
import { sanitizeStructuredNodeHtmlClient, structuredNodeHtmlToPlainText } from '../components/structuredNodeHtml'
import MathContentRenderer from '../../components/math/MathContentRenderer'

const tabs = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'node-types', label: 'Loại nút' },
  { id: 'content-tree', label: 'Cây nội dung' },
  { id: 'import-json', label: 'Import JSON' },
  { id: 'history', label: 'Lịch sử' },
]

const emptyTreeForm = {
  treeCode: '',
  title: '',
  description: '',
  status: 'draft',
}

const emptyNodeTypeForm = {
  typeCode: '',
  title: '',
  description: '',
  status: 'active',
}

const emptyNodeForm = {
  keyCode: '',
  title: '',
  body: '',
  bodyFormat: 'text',
  nodeTypeId: '',
  parentId: '',
  sortOrder: '0',
  sourceReference: '',
}

const HTML_CAPABLE_NODE_TYPES = new Set(['section', 'paragraph', 'group', 'content'])
const TEXT_ONLY_NODE_TYPES = new Set(['requirement', 'criterion'])

function getSourceReferenceValue(node) {
  const metadata = node?.metadata || {}
  if (typeof metadata === 'string') return metadata
  return String(metadata?.sourceReference || '').trim()
}

function stripHtml(value) {
  return structuredNodeHtmlToPlainText(value)
}

function getNodeDisplayLabel(node) {
  const title = String(node?.title || '').trim()
  const keyCode = String(node?.keyCode || '').trim()
  const normalizedType = String(node?.nodeType?.typeCode || node?.nodeTypeCode || '').trim().toLowerCase()
  const bodyText = stripHtml(node?.body || '')

  if (['requirement', 'criterion', 'paragraph'].includes(normalizedType)) {
    if (bodyText) return bodyText.slice(0, 120)
    if (title) return title
    if (keyCode) return keyCode
    return 'Node'
  }

  if (title) return title
  if (bodyText) return bodyText.slice(0, 120)
  if (keyCode) return keyCode
  return 'Node'
}

function normalizeBodyFormat(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return normalized === 'html' ? 'html' : 'text'
}

function getNodeTypeCodeById(nodeTypeId, nodeTypes) {
  const found = (nodeTypes || []).find((item) => String(item.id) === String(nodeTypeId))
  return String(found?.typeCode || '').trim().toLowerCase()
}

function isHtmlAllowedForNodeTypeCode(typeCode) {
  const normalized = String(typeCode || '').trim().toLowerCase()
  if (!normalized) return true
  if (TEXT_ONLY_NODE_TYPES.has(normalized)) return false
  return HTML_CAPABLE_NODE_TYPES.has(normalized)
}

function getMeaningfulNodeEntries(node) {
  const entries = []
  const keyCode = String(node?.keyCode || '').trim()
  const title = String(node?.title || '').trim()
  const body = String(node?.body || '').trim()
  const nodeType = String(node?.nodeType?.typeCode || node?.nodeTypeCode || '').trim()
  const bodyFormat = normalizeBodyFormat(node?.bodyFormat)
  const parentKeyCode = String(node?.parent?.keyCode || node?.parentKeyCode || '').trim()
  const sortOrder = node?.sortOrder ?? node?.sortOrderValue
  const sourceReference = String(getSourceReferenceValue(node) || '').trim()

  if (title) entries.push(['Title', title])
  if (body) entries.push(['Body', body])
  if (body) entries.push(['Body Format', bodyFormat])
  if (keyCode) entries.push(['KeyCode', keyCode])
  if (nodeType) entries.push(['Node Type', nodeType])
  if (parentKeyCode) entries.push(['Parent', parentKeyCode])
  if (sortOrder !== undefined && sortOrder !== null && sortOrder !== '') entries.push(['Sort Order', sortOrder])
  if (sourceReference) entries.push(['Source Reference', sourceReference])

  const requirement = node?.requirement
  const criterion = node?.criterion
  if (requirement && typeof requirement === 'object' && Object.keys(requirement).length > 0) entries.push(['Requirement', requirement])
  if (criterion && typeof criterion === 'object' && Object.keys(criterion).length > 0) entries.push(['Criterion', criterion])

  return entries
}

function downloadStructuredTreeTemplate() {
  const content = JSON.stringify({
    treeCode: 'sample_tree',
    title: 'Sample Tree',
    nodes: [
      {
        keyCode: 'ROOT-01',
        title: 'Root Node',
        body: '<p>Root content</p>',
        bodyFormat: 'html',
        nodeTypeCode: 'section',
        parentKeyCode: null,
        sortOrder: 1,
        sourceReference: 'source-system',
      },
      {
        keyCode: 'CHILD-01',
        title: 'Child Node',
        body: '<p>Nested content</p>',
        bodyFormat: 'html',
        nodeTypeCode: 'content',
        parentKeyCode: 'ROOT-01',
        sortOrder: 1,
        sourceReference: 'source-system-child',
      },
    ],
  }, null, 2)

  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'structured-tree-template.json'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function PlatformStructuredTreeManager() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [trees, setTrees] = useState([])
  const [nodeTypes, setNodeTypes] = useState([])
  const [selectedTreeId, setSelectedTreeId] = useState('')
  const [selectedTree, setSelectedTree] = useState(null)
  const [nodes, setNodes] = useState([])
  const [treeHierarchy, setTreeHierarchy] = useState([])
  const [treeDataLoading, setTreeDataLoading] = useState(false)
  const [treeDataError, setTreeDataError] = useState('')
  const [treeHierarchyMeta, setTreeHierarchyMeta] = useState(null)
  const [orphanNodes, setOrphanNodes] = useState([])
  const [importBatches, setImportBatches] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedIds, setExpandedIds] = useState([])
  const [selectedNode, setSelectedNode] = useState(null)
  const [nodeDetailModalOpen, setNodeDetailModalOpen] = useState(false)
  const [nodeDetailLoading, setNodeDetailLoading] = useState(false)
  const [nodeDetailError, setNodeDetailError] = useState('')
  const [selectedNodeDetail, setSelectedNodeDetail] = useState(null)
  const [treeModalOpen, setTreeModalOpen] = useState(false)
  const [treeForm, setTreeForm] = useState(emptyTreeForm)
  const [editingTreeId, setEditingTreeId] = useState(null)
  const [nodeTypeModalOpen, setNodeTypeModalOpen] = useState(false)
  const [nodeTypeForm, setNodeTypeForm] = useState(emptyNodeTypeForm)
  const [editingNodeTypeId, setEditingNodeTypeId] = useState(null)
  const [nodeModalOpen, setNodeModalOpen] = useState(false)
  const [nodeForm, setNodeForm] = useState(emptyNodeForm)
  const [editingNodeId, setEditingNodeId] = useState(null)
  const [importFileName, setImportFileName] = useState('')
  const [importPreview, setImportPreview] = useState(null)
  const [importLoading, setImportLoading] = useState(false)
  const [confirmingImport, setConfirmingImport] = useState(false)

  async function fetchAllData() {
    setLoading(true)
    setError('')

    try {
      const [treesResult, nodeTypesResult, batchesResult] = await Promise.all([
        getStructuredTrees({ limit: 100 }),
        getStructuredNodeTypes({ limit: 100 }),
        getStructuredImportBatches({ limit: 20 }),
      ])

      const nextTrees = Array.isArray(treesResult?.data) ? treesResult.data : []
      const nextNodeTypes = Array.isArray(nodeTypesResult?.data) ? nodeTypesResult.data : []
      const nextBatches = Array.isArray(batchesResult?.data) ? batchesResult.data : []

      setTrees(nextTrees)
      setNodeTypes(nextNodeTypes)
      setImportBatches(nextBatches)

      if (!selectedTreeId && nextTrees.length > 0) {
        setSelectedTreeId(String(nextTrees[0].id))
      }
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không tải được dữ liệu Structured Tree'))
    } finally {
      setLoading(false)
    }
  }

  async function fetchAllStructuredTreeNodes(treeId) {
    const allNodes = []
    let offset = 0
    const pageLimit = 100

    while (true) {
      const pageResult = await getStructuredTreeNodes(treeId, { limit: pageLimit, offset })
      const pageNodes = Array.isArray(pageResult?.data) ? pageResult.data : []

      if (!pageNodes.length) break

      allNodes.push(...pageNodes)

      const total = Number(pageResult?.pagination?.total || 0)
      if (allNodes.length >= total || pageNodes.length < pageLimit) break

      offset += pageNodes.length
    }

    return allNodes
  }

  async function loadTreeData(treeId = selectedTreeId) {
    if (!treeId) {
      setSelectedTree(null)
      setNodes([])
      setTreeHierarchy([])
      setTreeHierarchyMeta(null)
      setOrphanNodes([])
      setTreeDataError('')
      return
    }

    setTreeDataLoading(true)
    setTreeDataError('')

    try {
      const [treeResult, allNodes, hierarchyResult] = await Promise.all([
        getStructuredTreeById(treeId),
        fetchAllStructuredTreeNodes(treeId),
        getStructuredTreeHierarchy(treeId),
      ])

      setSelectedTree(treeResult || null)
      setNodes(allNodes)
      const nextHierarchy = Array.isArray(hierarchyResult?.hierarchy) ? hierarchyResult.hierarchy : []
      setTreeHierarchy(nextHierarchy)
      setTreeHierarchyMeta(hierarchyResult?.meta || null)
      setOrphanNodes(Array.isArray(hierarchyResult?.orphanNodes) ? hierarchyResult.orphanNodes : [])
      setExpandedIds((prev) => (prev.length > 0 ? prev : nextHierarchy.map((node) => Number(node.id)).slice(0, 10)))
    } catch (requestError) {
      setTreeDataError(getApiMessage(requestError, 'Không tải được dữ liệu cây'))
      setTreeHierarchy([])
      setTreeHierarchyMeta(null)
      setOrphanNodes([])
    } finally {
      setTreeDataLoading(false)
    }
  }

  useEffect(() => {
    fetchAllData()
  }, [])

  useEffect(() => {
    if (selectedTreeId) {
      loadTreeData(selectedTreeId)
    }
  }, [selectedTreeId])

  const filteredNodes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return nodes
    return nodes.filter((node) => {
      const title = String(node.title || '').toLowerCase()
      const keyCode = String(node.keyCode || '').toLowerCase()
      return title.includes(term) || keyCode.includes(term)
    })
  }, [nodes, searchTerm])

  const selectedNodeRecord = useMemo(() => {
    if (!selectedNode) return null
    return nodes.find((node) => Number(node.id) === Number(selectedNode)) || null
  }, [nodes, selectedNode])

  function filterTreeNodeTree(nodesToFilter, term) {
    if (!term) return nodesToFilter

    return nodesToFilter.reduce((result, node) => {
      const matches = String(node.title || '').toLowerCase().includes(term)
        || String(node.keyCode || '').toLowerCase().includes(term)
      const filteredChildren = node.children ? filterTreeNodeTree(node.children, term) : []

      if (matches || filteredChildren.length > 0) {
        result.push({ ...node, children: filteredChildren })
      }

      return result
    }, [])
  }

  const visibleTreeNodes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return filterTreeNodeTree(treeHierarchy, term)
  }, [treeHierarchy, searchTerm])

  const hasSearchTerm = searchTerm.trim().length > 0

  function getSiblingsForNode(node) {
    if (!node || !selectedTreeId) return []

    const parentId = node?.parent?.id ?? node?.parentId ?? null

    return nodes
      .filter((candidate) => {
        const candidateParentId = candidate?.parent?.id ?? candidate?.parentId ?? null
        if (parentId === null || parentId === undefined) {
          return candidateParentId === null || candidateParentId === undefined || candidateParentId === ''
        }
        return Number(candidateParentId) === Number(parentId)
      })
      .sort((left, right) => {
        const leftOrder = Number(left?.sortOrder ?? 0)
        const rightOrder = Number(right?.sortOrder ?? 0)
        if (leftOrder !== rightOrder) return leftOrder - rightOrder
        return String(left?.keyCode || '').localeCompare(String(right?.keyCode || ''))
      })
  }

  async function openNodeDetail(nodeId) {
    if (!selectedTreeId || nodeId === null || nodeId === undefined || nodeId === '') {
      return
    }

    const numericNodeId = Number(nodeId)
    setSelectedNode(numericNodeId)
    setNodeDetailError('')
    setNodeDetailLoading(true)

    try {
      let nextNode = nodes.find((candidate) => Number(candidate.id) === numericNodeId)

      if (!nextNode) {
        const refreshedNodes = await fetchAllStructuredTreeNodes(selectedTreeId)
        setNodes(refreshedNodes)
        nextNode = refreshedNodes.find((candidate) => Number(candidate.id) === numericNodeId)
      }

      if (!nextNode) {
        throw new Error(`Node ${nodeId} không tồn tại trong cây hiện tại.`)
      }

      setSelectedNodeDetail(nextNode)
      setNodeDetailModalOpen(true)
    } catch (requestError) {
      setSelectedNodeDetail(null)
      setNodeDetailError(getApiMessage(requestError, 'Không tải được chi tiết Node'))
      setNodeDetailModalOpen(true)
    } finally {
      setNodeDetailLoading(false)
    }
  }

  function closeNodeDetailModal() {
    setNodeDetailModalOpen(false)
    setNodeDetailError('')
    setSelectedNodeDetail(null)
  }

  const renderTreeNode = (node, depth = 0) => {
    const hasChildren = Array.isArray(node.children) && node.children.length > 0
    const isExpanded = expandedIds.includes(Number(node.id))
    const displayLabel = getNodeDisplayLabel(node)
    const sortOrder = node?.sortOrder ?? node?.sortOrderValue
    const normalizedType = String(node?.nodeType?.typeCode || node?.nodeTypeCode || '').trim().toLowerCase()
    const isRequirementLike = ['requirement', 'criterion'].includes(normalizedType)
    const clampTextStyle = {
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'normal',
      lineHeight: 1.4,
      maxWidth: '100%',
    }

    return (
      <div key={node.id} style={{ marginLeft: depth > 0 ? 18 : 0 }}>
        <div className='d-flex align-items-center gap-2 py-1' style={{ minWidth: 0 }}>
          {hasChildren ? (
            <CButton size='sm' variant='outline' color='secondary' onClick={() => {
              setExpandedIds((prev) => {
                const next = new Set(prev)
                if (next.has(Number(node.id))) next.delete(Number(node.id))
                else next.add(Number(node.id))
                return [...next]
              })
            }}>
              {isExpanded ? '−' : '+'}
            </CButton>
          ) : (<span style={{ width: 31, display: 'inline-block' }} />)}
          <button
            type='button'
            className='structured-tree-node-btn'
            onClick={() => openNodeDetail(node.id)}
            title={node?.keyCode || undefined}
            aria-label={node?.keyCode || displayLabel}
            style={{
              flex: 1,
              minWidth: 0,
              width: '100%',
              fontWeight: selectedNode === Number(node.id) ? 700 : 400,
              fontSize: isRequirementLike ? '0.96rem' : '0.95rem',
              color: '#1f2937',
              textDecoration: 'none',
              textAlign: 'left',
              background: 'transparent',
              border: 'none',
              padding: '2px 4px',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              maxWidth: '100%',
            }}
          >
            {isRequirementLike && (
              <span style={{ flexShrink: 0, paddingTop: 1, lineHeight: 1.4, color: '#4b5563' }}>–</span>
            )}
            <span style={{ ...clampTextStyle, flex: 1, minWidth: 0 }}>
              <MathContentRenderer value={displayLabel} contentType='plain_text' wrapperTag='span' emptyFallback='Node' />
            </span>
            {!isRequirementLike && sortOrder !== undefined && sortOrder !== null && sortOrder !== '' && (
              <span className='badge rounded-pill text-bg-light border' style={{ fontSize: '0.7rem', flexShrink: 0, marginTop: 2 }}>
                {sortOrder}
              </span>
            )}
          </button>
        </div>
        {isExpanded && hasChildren && (
          <div>{node.children.map((child) => renderTreeNode(child, depth + 1))}</div>
        )}
      </div>
    )
  }

  async function handleDeleteTree(tree) {
    if (!tree?.id) return
    if (!window.confirm(`Xóa Tree "${tree.title || tree.treeCode}"?`)) return

    try {
      await deleteStructuredTree(tree.id)
      setSuccess('Đã xóa Tree thành công')
      setSelectedTreeId('')
      setSelectedTree(null)
      await fetchAllData()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không xóa được Tree'))
    }
  }

  async function handleTreeSubmit() {
    if (!treeForm.treeCode || !treeForm.title) {
      setError('treeCode và title không được để trống')
      return
    }

    try {
      if (editingTreeId) {
        await updateStructuredTree(editingTreeId, {
          title: treeForm.title,
          description: treeForm.description,
          status: treeForm.status,
        })
      } else {
        await createStructuredTree({
          treeCode: treeForm.treeCode,
          title: treeForm.title,
          description: treeForm.description,
          status: treeForm.status,
        })
      }

      setTreeModalOpen(false)
      setTreeForm(emptyTreeForm)
      setEditingTreeId(null)
      setSuccess('Đã lưu Tree thành công')
      await fetchAllData()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không lưu được Tree'))
    }
  }

  async function handleNodeTypeSubmit() {
    if (!nodeTypeForm.typeCode || !nodeTypeForm.title) {
      setError('typeCode và title không được để trống')
      return
    }

    try {
      const payload = {
        typeCode: nodeTypeForm.typeCode,
        title: nodeTypeForm.title,
        description: nodeTypeForm.description,
        status: nodeTypeForm.status,
      }

      if (editingNodeTypeId) {
        await updateStructuredNodeType(editingNodeTypeId, payload)
      } else {
        await createStructuredNodeType(payload)
      }

      setNodeTypeModalOpen(false)
      setNodeTypeForm(emptyNodeTypeForm)
      setEditingNodeTypeId(null)
      setSuccess('Đã lưu Node Type thành công')
      await fetchAllData()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không lưu được Node Type'))
    }
  }

  async function handleDeleteNodeType(nodeType) {
    if (!window.confirm(`Xóa Node Type "${nodeType.title || nodeType.typeCode}"?`)) return
    try {
      await deleteStructuredNodeType(nodeType.id)
      setSuccess('Đã xóa Node Type thành công')
      await fetchAllData()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không xóa được Node Type'))
    }
  }

  async function handleNodeSubmit() {
    if (!selectedTreeId) {
      setError('Vui lòng chọn Tree trước khi thêm/sửa Node')
      return
    }

    if (!nodeForm.keyCode || !nodeForm.nodeTypeId) {
      setError('keyCode và nodeTypeId không được để trống')
      return
    }

    const selectedNodeTypeCode = getNodeTypeCodeById(nodeForm.nodeTypeId, nodeTypes)
    if (normalizeBodyFormat(nodeForm.bodyFormat) === 'html' && !isHtmlAllowedForNodeTypeCode(selectedNodeTypeCode)) {
      setError(`Node type "${selectedNodeTypeCode || 'unknown'}" chỉ hỗ trợ bodyFormat=text trong V1`)
      return
    }

    const payload = {
      keyCode: nodeForm.keyCode,
      title: nodeForm.title,
      body: nodeForm.body,
      bodyFormat: normalizeBodyFormat(nodeForm.bodyFormat),
      nodeTypeId: nodeForm.nodeTypeId,
      parentId: nodeForm.parentId || null,
      sortOrder: Number(nodeForm.sortOrder || 0),
      sourceReference: nodeForm.sourceReference || undefined,
      metadata: nodeForm.sourceReference ? { sourceReference: nodeForm.sourceReference } : null,
    }

    try {
      if (editingNodeId) {
        await updateStructuredNode(selectedTreeId, editingNodeId, payload)
      } else {
        await createStructuredNode(selectedTreeId, payload)
      }

      setNodeModalOpen(false)
      setNodeForm(emptyNodeForm)
      setEditingNodeId(null)
      setSuccess('Đã lưu Node thành công')
      await loadTreeData(selectedTreeId)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không lưu được Node'))
    }
  }

  async function handleDeleteNode(node) {
    if (!selectedTreeId) return
    if (!window.confirm(`Xóa Node "${node.title || node.keyCode}"?`)) return
    try {
      await deleteStructuredNode(selectedTreeId, node.id)
      setSuccess('Đã xóa Node thành công')
      await loadTreeData(selectedTreeId)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không xóa được Node'))
    }
  }

  async function handlePreviewImport(file) {
    if (!file || !selectedTreeId) return

    setImportLoading(true)
    setError('')

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const payloadNodes = Array.isArray(parsed?.nodes) ? parsed.nodes : Array.isArray(parsed) ? parsed : []

      if (!payloadNodes.length) {
        setImportPreview(null)
        setError('File JSON phải có mảng nodes hoặc object nodes')
        return
      }

      const result = await previewStructuredImport({ treeId: selectedTreeId, nodes: payloadNodes })
      setImportPreview(result)
      setImportFileName(file.name)
      setSuccess('Preview import đã được tạo')
    } catch (requestError) {
      setImportPreview(null)
      setError(getApiMessage(requestError, 'Không preview được file JSON'))
    } finally {
      setImportLoading(false)
    }
  }

  async function handleConfirmImport() {
    if (!importPreview?.previewId) {
      setError('Chưa có preview hợp lệ')
      return
    }

    if ((importPreview.summary?.conflicts || 0) > 0) {
      setError('Không thể Confirm khi có Conflict. Vui lòng Preview lại sau khi sửa JSON.')
      return
    }

    setConfirmingImport(true)
    setError('')

    try {
      const result = await confirmStructuredImport({
        previewId: importPreview.previewId,
        batchCode: `structured-tree-${Date.now()}`,
      })
      setImportPreview(null)
      setImportFileName('')
      setSuccess(result?.status === 'completed' ? 'Import đã Confirm thành công' : 'Confirm import hoàn tất')
      await fetchAllData()
      if (selectedTreeId) await loadTreeData(selectedTreeId)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không Confirm được JSON import'))
    } finally {
      setConfirmingImport(false)
    }
  }

  const detailNodeSiblings = selectedNodeDetail ? getSiblingsForNode(selectedNodeDetail) : []
  const detailNodeIndex = selectedNodeDetail ? detailNodeSiblings.findIndex((item) => Number(item.id) === Number(selectedNodeDetail.id)) : -1
  const detailPrevNode = detailNodeIndex > 0 ? detailNodeSiblings[detailNodeIndex - 1] : null
  const detailNextNode = detailNodeIndex >= 0 && detailNodeIndex < detailNodeSiblings.length - 1 ? detailNodeSiblings[detailNodeIndex + 1] : null
  const detailBodyFormat = normalizeBodyFormat(selectedNodeDetail?.bodyFormat)
  const nodeFormTypeCode = getNodeTypeCodeById(nodeForm.nodeTypeId, nodeTypes)
  const nodeFormHtmlAllowed = isHtmlAllowedForNodeTypeCode(nodeFormTypeCode)
  const nodeFormBodyFormat = normalizeBodyFormat(nodeForm.bodyFormat)

  function renderNodeDetailValue(label, value) {
    if (label === 'Body') {
      return (
        <MathContentRenderer
          className='structured-node-html-content'
          value={value}
          contentType={detailBodyFormat === 'html' ? 'html' : 'plain_text'}
          sanitizeHtml={detailBodyFormat === 'html' ? sanitizeStructuredNodeHtmlClient : undefined}
          emptyFallback={<span>...</span>}
        />
      )
    }

    if (label === 'Title') {
      return <MathContentRenderer value={value} contentType='plain_text' wrapperTag='span' emptyFallback={<span />}/>
    }

    return String(value)
  }

  return (
    <>
      <style>{`
        .structured-tree-node-btn {
          transition: color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
        }
        .structured-tree-node-btn:hover {
          color: #0f172a;
          background: rgba(15, 23, 42, 0.04);
        }
        .structured-tree-node-btn:focus {
          outline: 2px solid rgba(37, 99, 235, 0.5);
          outline-offset: 2px;
          background: rgba(59, 130, 246, 0.06);
        }
        .structured-node-html-content {
          overflow-x: auto;
        }
        .structured-node-html-content table {
          width: 100%;
          border-collapse: collapse;
          min-width: 520px;
        }
        .structured-node-html-content th,
        .structured-node-html-content td {
          border: 1px solid #d1d5db;
          padding: 8px 10px;
          vertical-align: top;
        }
        .structured-node-html-content thead th {
          background: #f3f4f6;
          font-weight: 600;
        }
      `}</style>
      <div className='container-fluid py-4'>
      <CRow className='mb-3 align-items-center'>
        <CCol>
          <h3>Structured Tree Manager</h3>
        </CCol>
        <CCol className='text-end'>
          <CButton color='primary' onClick={() => setTreeModalOpen(true)}>+ Tree</CButton>
        </CCol>
      </CRow>

      {error && <CAlert color='danger'>{error}</CAlert>}
      {success && <CAlert color='success'>{success}</CAlert>}

      <div className='mb-4'>
        <div className='d-flex flex-wrap gap-2'>
          {tabs.map((tab) => (
            <CButton
              key={tab.id}
              color={activeTab === tab.id ? 'primary' : 'secondary'}
              variant={activeTab === tab.id ? undefined : 'outline'}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </CButton>
          ))}
        </div>
      </div>

      {loading ? (
        <div className='text-center py-5'><CSpinner /></div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <>
              <CRow className='g-3 mb-4'>
                <CCol md={3}><CCard><CCardBody><div className='text-muted'>Total Trees</div><h3>{trees.length}</h3></CCardBody></CCard></CCol>
                <CCol md={3}><CCard><CCardBody><div className='text-muted'>Total Nodes</div><h3>{nodes.length}</h3></CCardBody></CCard></CCol>
                <CCol md={3}><CCard><CCardBody><div className='text-muted'>Node Types</div><h3>{nodeTypes.length}</h3></CCardBody></CCard></CCol>
                <CCol md={3}><CCard><CCardBody><div className='text-muted'>Import Batches</div><h3>{importBatches.length}</h3></CCardBody></CCard></CCol>
              </CRow>

              <CRow className='g-3'>
                <CCol lg={5}>
                  <CCard>
                    <CCardHeader><strong>Tree đang quản lý</strong></CCardHeader>
                    <CCardBody>
                      <CFormSelect value={selectedTreeId} onChange={(event) => setSelectedTreeId(event.target.value)}>
                        <option value=''>Chọn Tree</option>
                        {trees.map((tree) => (
                          <option key={tree.id} value={tree.id}>{tree.title} ({tree.treeCode})</option>
                        ))}
                      </CFormSelect>

                      {selectedTree ? (
                        <div className='mt-3 border rounded p-3'>
                          <div><strong>Tree Code:</strong> {selectedTree.treeCode}</div>
                          <div><strong>Title:</strong> {selectedTree.title}</div>
                          <div><strong>Status:</strong> <CBadge color={selectedTree.status === 'active' ? 'success' : 'secondary'}>{selectedTree.status}</CBadge></div>
                          <div className='mt-2 d-flex gap-2'>
                            <CButton size='sm' onClick={() => {
                              setTreeForm({
                                treeCode: selectedTree.treeCode || '',
                                title: selectedTree.title || '',
                                description: selectedTree.description || '',
                                status: selectedTree.status || 'draft',
                              })
                              setEditingTreeId(selectedTree.id)
                              setTreeModalOpen(true)
                            }}>Edit</CButton>
                            <CButton size='sm' color='danger' variant='outline' onClick={() => handleDeleteTree(selectedTree)}>Archive</CButton>
                          </div>
                        </div>
                      ) : (
                        <div className='mt-3 text-muted'>Chưa chọn Tree</div>
                      )}
                    </CCardBody>
                  </CCard>
                </CCol>

                <CCol lg={7}>
                  <CCard>
                    <CCardHeader><strong>Danh sách Tree</strong></CCardHeader>
                    <CCardBody>
                      {trees.length ? (
                        <CTable hover small>
                          <CTableHead>
                            <CTableRow>
                              <CTableHeaderCell>Code</CTableHeaderCell>
                              <CTableHeaderCell>Title</CTableHeaderCell>
                              <CTableHeaderCell>Status</CTableHeaderCell>
                            </CTableRow>
                          </CTableHead>
                          <CTableBody>
                            {trees.map((tree) => (
                              <CTableRow key={tree.id} onClick={() => setSelectedTreeId(String(tree.id))} style={{ cursor: 'pointer' }}>
                                <CTableDataCell>{tree.treeCode}</CTableDataCell>
                                <CTableDataCell>{tree.title}</CTableDataCell>
                                <CTableDataCell><CBadge color={tree.status === 'active' ? 'success' : 'secondary'}>{tree.status}</CBadge></CTableDataCell>
                              </CTableRow>
                            ))}
                          </CTableBody>
                        </CTable>
                      ) : (
                        <div className='text-muted'>Không có Tree nào</div>
                      )}
                    </CCardBody>
                  </CCard>
                </CCol>
              </CRow>
            </>
          )}

          {activeTab === 'node-types' && (
            <CCard>
              <CCardHeader className='d-flex justify-content-between align-items-center'>
                <strong>Node Types</strong>
                <CButton color='primary' onClick={() => {
                  setNodeTypeForm(emptyNodeTypeForm)
                  setEditingNodeTypeId(null)
                  setNodeTypeModalOpen(true)
                }}>+ Node Type</CButton>
              </CCardHeader>
              <CCardBody>
                {nodeTypes.length ? (
                  <CTable hover small>
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell>Type Code</CTableHeaderCell>
                        <CTableHeaderCell>Title</CTableHeaderCell>
                        <CTableHeaderCell>Status</CTableHeaderCell>
                        <CTableHeaderCell>Thao tác</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {nodeTypes.map((nodeType) => (
                        <CTableRow key={nodeType.id}>
                          <CTableDataCell>{nodeType.typeCode}</CTableDataCell>
                          <CTableDataCell>{nodeType.title}</CTableDataCell>
                          <CTableDataCell><CBadge color={nodeType.status === 'active' ? 'success' : 'secondary'}>{nodeType.status}</CBadge></CTableDataCell>
                          <CTableDataCell>
                            <div className='d-flex gap-2'>
                              <CButton size='sm' onClick={() => {
                                setNodeTypeForm({
                                  typeCode: nodeType.typeCode || '',
                                  title: nodeType.title || '',
                                  description: nodeType.description || '',
                                  status: nodeType.status || 'active',
                                })
                                setEditingNodeTypeId(nodeType.id)
                                setNodeTypeModalOpen(true)
                              }}>Sửa</CButton>
                              <CButton size='sm' color='danger' variant='outline' onClick={() => handleDeleteNodeType(nodeType)}>Xóa</CButton>
                            </div>
                          </CTableDataCell>
                        </CTableRow>
                      ))}
                    </CTableBody>
                  </CTable>
                ) : (
                  <div className='text-muted'>Chưa có Node Type nào</div>
                )}
              </CCardBody>
            </CCard>
          )}

          {activeTab === 'content-tree' && (
            <CCard>
              <CCardHeader className='d-flex justify-content-between align-items-center'>
                <strong>Cây nội dung</strong>
                <CButton color='primary' onClick={() => {
                  setNodeForm({ ...emptyNodeForm, nodeTypeId: nodeTypes[0]?.id || '', bodyFormat: 'text' })
                  setEditingNodeId(null)
                  setNodeModalOpen(true)
                }} disabled={!selectedTreeId}>+ Node</CButton>
              </CCardHeader>
              <CCardBody>
                <CRow className='mb-3'>
                  <CCol md={6}>
                    <CFormLabel>Tree</CFormLabel>
                    <CFormSelect value={selectedTreeId} onChange={(event) => setSelectedTreeId(event.target.value)}>
                      <option value=''>Chọn Tree</option>
                      {trees.map((tree) => <option key={tree.id} value={tree.id}>{tree.title}</option>)}
                    </CFormSelect>
                  </CCol>
                  <CCol md={6}>
                    <CFormLabel>Tìm kiếm</CFormLabel>
                    <CFormInput value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder='Tìm title hoặc keyCode' />
                  </CCol>
                </CRow>

                {selectedTreeId ? (
                  <CRow className='g-3'>
                    <CCol xs={12}>
                      <div className='border rounded p-3' style={{ minHeight: 420 }}>
                        {treeDataLoading ? (
                          <div className='text-center py-5'><CSpinner /></div>
                        ) : treeDataError ? (
                          <CAlert color='danger' className='mb-0'>
                            Lỗi tải cây: {treeDataError}
                          </CAlert>
                        ) : nodes.length === 0 ? (
                          <div className='text-muted'>Tree chưa có Node</div>
                        ) : treeHierarchy.length === 0 ? (
                          <CAlert color='warning' className='mb-0'>
                            Có {nodes.length} Node nhưng không dựng được cây phân cấp.
                            {orphanNodes.length > 0 ? ` Phát hiện ${orphanNodes.length} orphan node.` : ''}
                          </CAlert>
                        ) : visibleTreeNodes.length === 0 && hasSearchTerm ? (
                          <div className='text-muted'>Không có kết quả tìm kiếm</div>
                        ) : visibleTreeNodes.length > 0 ? (
                          <>{visibleTreeNodes.map((node) => renderTreeNode(node))}</>
                        ) : (
                          <div className='text-muted'>Không có node nào phù hợp</div>
                        )}
                      </div>
                      {orphanNodes.length > 0 && (
                        <CAlert color='warning' className='mt-3 mb-0'>
                          Phát hiện {orphanNodes.length} orphan node: {orphanNodes.slice(0, 5).map((item) => item.keyCode).join(', ')}
                          {orphanNodes.length > 5 ? ', ...' : ''}
                        </CAlert>
                      )}
                      {treeHierarchyMeta && (
                        <div className='small text-muted mt-2'>
                          Tổng node khả dụng: {treeHierarchyMeta.totalNodes || 0} · Root: {treeHierarchyMeta.rootNodes || 0} · Orphan: {treeHierarchyMeta.orphanNodes || 0}
                        </div>
                      )}
                    </CCol>
                  </CRow>
                ) : (
                  <div className='text-muted'>Chưa chọn Tree để xem cây</div>
                )}
              </CCardBody>
            </CCard>
          )}

          <CModal
            visible={nodeDetailModalOpen}
            onClose={closeNodeDetailModal}
            size='lg'
            scrollable
          >
            <CModalHeader>
              <CModalTitle>
                {selectedNodeDetail ? (
                  <MathContentRenderer
                    value={getNodeDisplayLabel(selectedNodeDetail)}
                    contentType='plain_text'
                    wrapperTag='span'
                    emptyFallback='Chi tiết Node'
                  />
                ) : 'Chi tiết Node'}
              </CModalTitle>
            </CModalHeader>
            <CModalBody style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              {nodeDetailLoading ? (
                <div className='text-center py-4'><CSpinner /></div>
              ) : nodeDetailError ? (
                <CAlert color='danger' className='mb-0'>{nodeDetailError}</CAlert>
              ) : selectedNodeDetail ? (
                <>
                  <div className='d-flex justify-content-between align-items-center gap-2 mb-3'>
                    <h6 className='mb-0'>
                      <MathContentRenderer
                        value={getNodeDisplayLabel(selectedNodeDetail)}
                        contentType='plain_text'
                        wrapperTag='span'
                        emptyFallback='Node'
                      />
                    </h6>
                    <div className='d-flex gap-2'>
                      <CButton size='sm' onClick={() => detailPrevNode && openNodeDetail(detailPrevNode.id)} disabled={!detailPrevNode}>Trước</CButton>
                      <CButton size='sm' onClick={() => detailNextNode && openNodeDetail(detailNextNode.id)} disabled={!detailNextNode}>Tiếp</CButton>
                      <CButton size='sm' onClick={() => {
                        setNodeForm({
                          keyCode: selectedNodeDetail.keyCode || '',
                          title: selectedNodeDetail.title || '',
                          body: selectedNodeDetail.body || '',
                          bodyFormat: normalizeBodyFormat(selectedNodeDetail.bodyFormat),
                          nodeTypeId: selectedNodeDetail.nodeType?.id || '',
                          parentId: selectedNodeDetail.parent?.id || '',
                          sortOrder: String(selectedNodeDetail.sortOrder || 0),
                          sourceReference: getSourceReferenceValue(selectedNodeDetail),
                        })
                        setEditingNodeId(selectedNodeDetail.id)
                        setNodeDetailModalOpen(false)
                        setNodeModalOpen(true)
                      }}>Sửa</CButton>
                    </div>
                  </div>

                  {getMeaningfulNodeEntries(selectedNodeDetail).map(([label, value]) => (
                    <div key={label} className='mb-3'>
                      <div className='fw-semibold mb-1'>{label}</div>
                      {typeof value === 'object' ? (
                        <pre className='mb-0 bg-light p-2 rounded' style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(value, null, 2)}</pre>
                      ) : (
                        <div className='bg-light p-2 rounded' style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {renderNodeDetailValue(label, value)}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <div className='text-muted'>Không có dữ liệu Node để hiển thị.</div>
              )}
            </CModalBody>
            <CModalFooter>
              <CButton color='secondary' variant='outline' onClick={closeNodeDetailModal}>Đóng</CButton>
            </CModalFooter>
          </CModal>

          {activeTab === 'import-json' && (
            <CCard>
              <CCardHeader><strong>Import JSON</strong></CCardHeader>
              <CCardBody>
                <CRow className='g-3'>
                  <CCol md={6}>
                    <CFormLabel>Tree</CFormLabel>
                    <CFormSelect value={selectedTreeId} onChange={(event) => setSelectedTreeId(event.target.value)}>
                      <option value=''>Chọn Tree</option>
                      {trees.map((tree) => <option key={tree.id} value={tree.id}>{tree.title}</option>)}
                    </CFormSelect>
                  </CCol>
                  <CCol md={6} className='d-flex align-items-end'>
                    <CButton color='secondary' variant='outline' onClick={downloadStructuredTreeTemplate}>Tải JSON template</CButton>
                  </CCol>
                </CRow>

                <div className='mt-4'>
                  <CFormInput
                    type='file'
                    accept='.json,application/json'
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) handlePreviewImport(file)
                    }}
                  />
                  {importLoading && <div className='mt-3'><CSpinner size='sm'/> Đang preview...</div>}
                </div>

                {importPreview && (
                  <div className='mt-4 border rounded p-3'>
                    <div className='fw-bold'>{importFileName}</div>
                    <div className='small text-muted mb-2'>Preview ID: {importPreview.previewId}</div>
                    <div className='mb-2'>
                      <CBadge color='primary' className='me-2'>New: {importPreview.summary?.new || 0}</CBadge>
                      <CBadge color='warning' className='me-2'>Update: {importPreview.summary?.updated || 0}</CBadge>
                      <CBadge color='success' className='me-2'>Unchanged: {importPreview.summary?.unchanged || 0}</CBadge>
                      <CBadge color='danger'>Conflict: {importPreview.summary?.conflicts || 0}</CBadge>
                    </div>

                    {(importPreview.validationErrors || []).length > 0 && (
                      <div className='mt-3'>
                        <div className='small text-muted'>Validation errors</div>
                        <ul className='small mb-0'>
                          {(importPreview.validationErrors || []).slice(0, 5).map((item, index) => (
                            <li key={`${item.keyCode}-${index}`}>{item.keyCode}: {Array.isArray(item.errors) ? item.errors.join(', ') : item.errors}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className='mt-3 d-flex gap-2'>
                      <CButton color='success' disabled={(importPreview.summary?.conflicts || 0) > 0 || confirmingImport} onClick={handleConfirmImport}>
                        {confirmingImport ? 'Confirming...' : 'Confirm'}
                      </CButton>
                      <CButton color='secondary' variant='outline' onClick={() => setImportPreview(null)}>Clear</CButton>
                    </div>
                  </div>
                )}
              </CCardBody>
            </CCard>
          )}

          {activeTab === 'history' && (
            <CCard>
              <CCardHeader><strong>Lịch sử Import</strong></CCardHeader>
              <CCardBody>
                {importBatches.length ? (
                  <CTable hover small>
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell>Batch</CTableHeaderCell>
                        <CTableHeaderCell>Status</CTableHeaderCell>
                        <CTableHeaderCell>Thời gian</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {importBatches.map((batch) => (
                        <CTableRow key={batch.id}>
                          <CTableDataCell>{batch.batchCode}</CTableDataCell>
                          <CTableDataCell><CBadge color={batch.status === 'completed' ? 'success' : 'secondary'}>{batch.status}</CBadge></CTableDataCell>
                          <CTableDataCell>{batch.completedAt ? new Date(batch.completedAt).toLocaleString() : '-'}</CTableDataCell>
                        </CTableRow>
                      ))}
                    </CTableBody>
                  </CTable>
                ) : (
                  <div className='text-muted'>Chưa có batch import nào</div>
                )}
              </CCardBody>
            </CCard>
          )}
        </>
      )}

      <CModal visible={treeModalOpen} onClose={() => { setTreeModalOpen(false); setTreeForm(emptyTreeForm); setEditingTreeId(null) }}>
        <CModalHeader>
          <CModalTitle>{editingTreeId ? 'Edit Tree' : 'Create Tree'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className='mb-3'>
            <CFormLabel>Tree Code</CFormLabel>
            <CFormInput value={treeForm.treeCode} onChange={(event) => setTreeForm((prev) => ({ ...prev, treeCode: event.target.value }))} disabled={Boolean(editingTreeId)} />
          </div>
          <div className='mb-3'>
            <CFormLabel>Title</CFormLabel>
            <CFormInput value={treeForm.title} onChange={(event) => setTreeForm((prev) => ({ ...prev, title: event.target.value }))} />
          </div>
          <div className='mb-3'>
            <CFormLabel>Description</CFormLabel>
            <CFormTextarea rows={4} value={treeForm.description} onChange={(event) => setTreeForm((prev) => ({ ...prev, description: event.target.value }))} />
          </div>
          <div className='mb-3'>
            <CFormLabel>Status</CFormLabel>
            <CFormSelect value={treeForm.status} onChange={(event) => setTreeForm((prev) => ({ ...prev, status: event.target.value }))}>
              <option value='draft'>Draft</option>
              <option value='active'>Active</option>
              <option value='archived'>Archived</option>
            </CFormSelect>
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => { setTreeModalOpen(false); setTreeForm(emptyTreeForm); setEditingTreeId(null) }}>Cancel</CButton>
          <CButton color='primary' onClick={handleTreeSubmit}>{editingTreeId ? 'Save Tree' : 'Create Tree'}</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={nodeTypeModalOpen} onClose={() => { setNodeTypeModalOpen(false); setNodeTypeForm(emptyNodeTypeForm); setEditingNodeTypeId(null) }}>
        <CModalHeader>
          <CModalTitle>{editingNodeTypeId ? 'Edit Node Type' : 'Create Node Type'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className='mb-3'>
            <CFormLabel>Type Code</CFormLabel>
            <CFormInput value={nodeTypeForm.typeCode} onChange={(event) => setNodeTypeForm((prev) => ({ ...prev, typeCode: event.target.value }))} />
          </div>
          <div className='mb-3'>
            <CFormLabel>Title</CFormLabel>
            <CFormInput value={nodeTypeForm.title} onChange={(event) => setNodeTypeForm((prev) => ({ ...prev, title: event.target.value }))} />
          </div>
          <div className='mb-3'>
            <CFormLabel>Description</CFormLabel>
            <CFormTextarea rows={3} value={nodeTypeForm.description} onChange={(event) => setNodeTypeForm((prev) => ({ ...prev, description: event.target.value }))} />
          </div>
          <div className='mb-3'>
            <CFormLabel>Status</CFormLabel>
            <CFormSelect value={nodeTypeForm.status} onChange={(event) => setNodeTypeForm((prev) => ({ ...prev, status: event.target.value }))}>
              <option value='active'>Active</option>
              <option value='inactive'>Inactive</option>
            </CFormSelect>
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => { setNodeTypeModalOpen(false); setNodeTypeForm(emptyNodeTypeForm); setEditingNodeTypeId(null) }}>Cancel</CButton>
          <CButton color='primary' onClick={handleNodeTypeSubmit}>{editingNodeTypeId ? 'Save Node Type' : 'Create Node Type'}</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={nodeModalOpen} onClose={() => { setNodeModalOpen(false); setNodeForm(emptyNodeForm); setEditingNodeId(null) }} size='lg'>
        <CModalHeader>
          <CModalTitle>{editingNodeId ? 'Edit Node' : 'Create Node'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CRow className='g-3'>
            <CCol md={6}>
              <CFormLabel>Key Code</CFormLabel>
              <CFormInput value={nodeForm.keyCode} onChange={(event) => setNodeForm((prev) => ({ ...prev, keyCode: event.target.value }))} />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Node Type</CFormLabel>
              <CFormSelect value={nodeForm.nodeTypeId} onChange={(event) => {
                const nextTypeId = event.target.value
                const nextTypeCode = getNodeTypeCodeById(nextTypeId, nodeTypes)
                const htmlAllowed = isHtmlAllowedForNodeTypeCode(nextTypeCode)
                setNodeForm((prev) => ({
                  ...prev,
                  nodeTypeId: nextTypeId,
                  bodyFormat: htmlAllowed ? prev.bodyFormat : 'text',
                }))
              }}>
                <option value=''>Chọn loại</option>
                {nodeTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.title || type.typeCode}</option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={6}>
              <CFormLabel>Parent</CFormLabel>
              <CFormSelect value={nodeForm.parentId} onChange={(event) => setNodeForm((prev) => ({ ...prev, parentId: event.target.value }))}>
                <option value=''>Root node</option>
                {nodes.map((node) => (
                  <option key={node.id} value={node.id}>{node.title || node.keyCode}</option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={6}>
              <CFormLabel>Sort Order</CFormLabel>
              <CFormInput value={nodeForm.sortOrder} onChange={(event) => setNodeForm((prev) => ({ ...prev, sortOrder: event.target.value }))} />
            </CCol>
            <CCol md={12}>
              <CFormLabel>Title</CFormLabel>
              <CFormInput value={nodeForm.title} onChange={(event) => setNodeForm((prev) => ({ ...prev, title: event.target.value }))} />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Body Format</CFormLabel>
              <CFormSelect
                value={nodeFormBodyFormat}
                onChange={(event) => setNodeForm((prev) => ({ ...prev, bodyFormat: event.target.value }))}
                disabled={!nodeFormHtmlAllowed}
              >
                <option value='text'>Text</option>
                {nodeFormHtmlAllowed ? <option value='html'>HTML</option> : null}
              </CFormSelect>
              {!nodeFormHtmlAllowed ? (
                <div className='small text-muted mt-1'>
                  Node type {nodeFormTypeCode || '(chưa xác định)'} chỉ hỗ trợ Text trong V1.
                </div>
              ) : null}
            </CCol>
            <CCol md={12}>
              <CFormLabel>Body</CFormLabel>
              {nodeFormBodyFormat === 'html' ? (
                <>
                  <SimpleHtmlEditor
                    label=''
                    value={nodeForm.body}
                    onChange={(value) => setNodeForm((prev) => ({ ...prev, body: value }))}
                    rows={10}
                    showImageControls={false}
                    showTableControls
                    allowHtmlMode
                    helperText='Dùng trình soạn thảo trực quan để tạo bảng/định dạng. Có thể chuyển sang HTML source khi cần.'
                    placeholder='<p>Nhập nội dung HTML...</p>'
                  />
                  <div className='mt-3'>
                    <div className='fw-semibold mb-1'>Preview trước khi lưu</div>
                    <div className='border rounded p-2 structured-node-html-content' style={{ maxHeight: 260, overflow: 'auto' }}>
                      <MathContentRenderer
                        className='structured-node-html-content'
                        value={nodeForm.body || ''}
                        contentType='html'
                        sanitizeHtml={sanitizeStructuredNodeHtmlClient}
                        emptyFallback={<div className='text-muted'>Chưa có nội dung</div>}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <CFormTextarea rows={6} value={nodeForm.body} onChange={(event) => setNodeForm((prev) => ({ ...prev, body: event.target.value }))} />
              )}
            </CCol>
            <CCol md={12}>
              <CFormLabel>Source Reference</CFormLabel>
              <CFormInput value={nodeForm.sourceReference} onChange={(event) => setNodeForm((prev) => ({ ...prev, sourceReference: event.target.value }))} />
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => { setNodeModalOpen(false); setNodeForm(emptyNodeForm); setEditingNodeId(null) }}>Cancel</CButton>
          <CButton color='primary' onClick={handleNodeSubmit}>{editingNodeId ? 'Save Node' : 'Create Node'}</CButton>
        </CModalFooter>
      </CModal>
      </div>
    </>
  )
}
