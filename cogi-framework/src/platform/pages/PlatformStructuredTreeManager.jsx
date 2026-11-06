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
  nodeTypeId: '',
  parentId: '',
  sortOrder: '0',
  sourceReference: '',
}

function getSourceReferenceValue(node) {
  const metadata = node?.metadata || {}
  if (typeof metadata === 'string') return metadata
  return String(metadata?.sourceReference || '').trim()
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
        nodeTypeCode: 'section',
        parentKeyCode: null,
        sortOrder: 1,
        sourceReference: 'source-system',
      },
      {
        keyCode: 'CHILD-01',
        title: 'Child Node',
        body: '<p>Nested content</p>',
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
      const [treeResult, nodesResult, hierarchyResult] = await Promise.all([
        getStructuredTreeById(treeId),
        getStructuredTreeNodes(treeId, { limit: 500 }),
        getStructuredTreeHierarchy(treeId),
      ])

      setSelectedTree(treeResult || null)
      setNodes(Array.isArray(nodesResult?.data) ? nodesResult.data : [])
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

  const renderTreeNode = (node, depth = 0) => {
    const hasChildren = Array.isArray(node.children) && node.children.length > 0
    const isExpanded = expandedIds.includes(Number(node.id))

    return (
      <div key={node.id} style={{ marginLeft: depth > 0 ? 18 : 0 }}>
        <div className='d-flex align-items-center gap-2 py-1'>
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
            className='btn btn-link text-start p-0'
            onClick={() => setSelectedNode(Number(node.id))}
            style={{ fontWeight: selectedNode === Number(node.id) ? 700 : 400 }}
          >
            {node.title || node.keyCode}
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

    const payload = {
      keyCode: nodeForm.keyCode,
      title: nodeForm.title,
      body: nodeForm.body,
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

  return (
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
                  setNodeForm({ ...emptyNodeForm, nodeTypeId: nodeTypes[0]?.id || '' })
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
                    <CCol lg={6}>
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
                    <CCol lg={6}>
                      <div className='border rounded p-3' style={{ minHeight: 420 }}>
                        {selectedNodeRecord ? (
                          <>
                            <div className='d-flex justify-content-between align-items-center mb-3'>
                              <h6 className='mb-0'>{selectedNodeRecord.title || selectedNodeRecord.keyCode}</h6>
                              <div className='d-flex gap-2'>
                                <CButton size='sm' onClick={() => {
                                  setNodeForm({
                                    keyCode: selectedNodeRecord.keyCode || '',
                                    title: selectedNodeRecord.title || '',
                                    body: selectedNodeRecord.body || '',
                                    nodeTypeId: selectedNodeRecord.nodeType?.id || '',
                                    parentId: selectedNodeRecord.parent?.id || '',
                                    sortOrder: String(selectedNodeRecord.sortOrder || 0),
                                    sourceReference: getSourceReferenceValue(selectedNodeRecord),
                                  })
                                  setEditingNodeId(selectedNodeRecord.id)
                                  setNodeModalOpen(true)
                                }}>Edit</CButton>
                                <CButton size='sm' color='danger' variant='outline' onClick={() => handleDeleteNode(selectedNodeRecord)}>Delete</CButton>
                              </div>
                            </div>
                            <div className='mb-2'><strong>KeyCode:</strong> {selectedNodeRecord.keyCode}</div>
                            <div className='mb-2'><strong>Node Type:</strong> {selectedNodeRecord.nodeType?.typeCode || '-'}</div>
                            <div className='mb-2'><strong>Parent:</strong> {selectedNodeRecord.parent?.keyCode || '-'}</div>
                            <div className='mb-2'><strong>Sort Order:</strong> {selectedNodeRecord.sortOrder || 0}</div>
                            <div className='mb-2'><strong>Source Reference:</strong> {getSourceReferenceValue(selectedNodeRecord) || '-'}</div>
                            <div className='mb-3'><strong>Body:</strong><div dangerouslySetInnerHTML={{ __html: selectedNodeRecord.body || '<p>...</p>' }} /></div>
                            <div className='mb-2'><strong>Requirement:</strong><pre className='mb-0'>{JSON.stringify(selectedNodeRecord.requirement || {}, null, 2)}</pre></div>
                            <div className='mb-2'><strong>Criterion:</strong><pre className='mb-0'>{JSON.stringify(selectedNodeRecord.criterion || {}, null, 2)}</pre></div>
                          </>
                        ) : (
                          <div className='text-muted'>Chọn 1 Node để xem chi tiết</div>
                        )}
                      </div>
                    </CCol>
                  </CRow>
                ) : (
                  <div className='text-muted'>Chưa chọn Tree để xem cây</div>
                )}
              </CCardBody>
            </CCard>
          )}

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
              <CFormSelect value={nodeForm.nodeTypeId} onChange={(event) => setNodeForm((prev) => ({ ...prev, nodeTypeId: event.target.value }))}>
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
            <CCol md={12}>
              <CFormLabel>Body</CFormLabel>
              <CFormTextarea rows={5} value={nodeForm.body} onChange={(event) => setNodeForm((prev) => ({ ...prev, body: event.target.value }))} />
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
  )
}
