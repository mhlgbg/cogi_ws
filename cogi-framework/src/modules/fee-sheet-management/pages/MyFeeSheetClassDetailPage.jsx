import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CNav,
  CNavItem,
  CNavLink,
  CRow,
  CSpinner,
  CTabContent,
  CTabPane,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { getMyFeeSheetClassById, submitMyFeeSheetClass, updateMyFeeItem } from '../services/feeSheetService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function formatCurrency(value) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount)) return '0'
  return amount.toLocaleString('vi-VN')
}

function formatStatus(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'approved') return { color: 'success', label: 'Approved' }
  if (normalized === 'submitted') return { color: 'info', label: 'Submitted' }
  if (normalized === 'paid') return { color: 'success', label: 'Paid' }
  if (normalized === 'partial') return { color: 'warning', label: 'Partial' }
  if (normalized === 'unpaid') return { color: 'secondary', label: 'Unpaid' }
  return { color: 'warning', label: 'Draft' }
}

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function createDraftItem(item) {
  return {
    quantity: String(item?.quantity ?? 0),
    unitPrice: String(item?.unitPrice ?? 0),
    discountPercent: String(item?.discountPercent ?? 0),
    discountAmount: String(item?.discountAmount ?? 0),
    note: item?.note || '',
  }
}

function buildDraftMap(items) {
  return (Array.isArray(items) ? items : []).reduce((accumulator, item) => {
    accumulator[item.id] = createDraftItem(item)
    return accumulator
  }, {})
}

function isItemDirty(item, draft) {
  if (!item || !draft) return false

  return (
    toNumber(draft.quantity) !== toNumber(item.quantity) ||
    toNumber(draft.unitPrice) !== toNumber(item.unitPrice) ||
    toNumber(draft.discountPercent) !== toNumber(item.discountPercent) ||
    toNumber(draft.discountAmount) !== toNumber(item.discountAmount) ||
    String(draft.note || '') !== String(item.note || '')
  )
}

function syncDraftsWithItems(items, previousDrafts = {}) {
  return (Array.isArray(items) ? items : []).reduce((accumulator, item) => {
    const previousDraft = previousDrafts[item.id]
    accumulator[item.id] = previousDraft && isItemDirty(item, previousDraft)
      ? previousDraft
      : createDraftItem(item)
    return accumulator
  }, {})
}

function computePreviewAmount(draft) {
  const quantity = Math.max(0, toNumber(draft?.quantity))
  const unitPrice = Math.max(0, toNumber(draft?.unitPrice))
  const discountPercent = Math.max(0, toNumber(draft?.discountPercent))
  const discountAmount = Math.max(0, toNumber(draft?.discountAmount))
  const grossAmount = quantity * unitPrice
  const percentDiscount = grossAmount * (discountPercent / 100)
  return Math.max(0, grossAmount - percentDiscount - discountAmount)
}

export default function MyFeeSheetClassDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [savingAll, setSavingAll] = useState(false)
  const [savingItemIds, setSavingItemIds] = useState({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [detail, setDetail] = useState(null)
  const [draftItems, setDraftItems] = useState({})
  const [activeTab, setActiveTab] = useState('entry')
  const [bulkQuantity, setBulkQuantity] = useState('')
  const [bulkUnitPrice, setBulkUnitPrice] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingItemId, setEditingItemId] = useState(null)
  const [itemForm, setItemForm] = useState(createDraftItem())

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await getMyFeeSheetClassById(id)
      setDetail(data)
      setDraftItems(buildDraftMap(data?.feeItems))
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể tải chi tiết bảng phí lớp'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  function setRowSaving(itemId, isSaving) {
    setSavingItemIds((prev) => {
      const next = { ...prev }
      if (isSaving) next[itemId] = true
      else delete next[itemId]
      return next
    })
  }

  function updateDraftField(itemId, field, value) {
    setDraftItems((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        [field]: value,
      },
    }))
  }

  function resetDraftForItem(item) {
    if (!item?.id) return
    setDraftItems((prev) => ({
      ...prev,
      [item.id]: createDraftItem(item),
    }))
  }

  function openEditModal(item) {
    const draft = draftItems[item.id] || createDraftItem(item)
    setEditingItemId(item.id)
    setItemForm({
      quantity: draft.quantity,
      unitPrice: draft.unitPrice,
      discountPercent: draft.discountPercent,
      discountAmount: draft.discountAmount,
      note: draft.note,
    })
    setShowModal(true)
  }

  function closeModal() {
    setEditingItemId(null)
    setItemForm(createDraftItem())
    setShowModal(false)
  }

  function applyModalDraft() {
    if (!editingItemId) return

    setDraftItems((prev) => ({
      ...prev,
      [editingItemId]: {
        ...(prev[editingItemId] || {}),
        unitPrice: itemForm.unitPrice,
        discountPercent: itemForm.discountPercent,
        discountAmount: itemForm.discountAmount,
        note: itemForm.note,
      },
    }))
    closeModal()
  }

  async function saveItemDraft(itemId, options = {}) {
    const currentDetail = options.currentDetail || detail
    const currentDrafts = options.currentDrafts || draftItems
    const item = Array.isArray(currentDetail?.feeItems)
      ? currentDetail.feeItems.find((entry) => entry.id === itemId)
      : null

    if (!item) return { detail: currentDetail, drafts: currentDrafts, changed: false }

    const draft = currentDrafts[itemId] || createDraftItem(item)
    if (!isItemDirty(item, draft)) {
      return { detail: currentDetail, drafts: currentDrafts, changed: false }
    }

    setRowSaving(itemId, true)
    setError('')
    try {
      const result = await updateMyFeeItem(id, itemId, {
        quantity: toNumber(draft.quantity),
        unitPrice: toNumber(draft.unitPrice),
        discountPercent: toNumber(draft.discountPercent),
        discountAmount: toNumber(draft.discountAmount),
        note: draft.note,
      })

      const nextDetail = result?.feeSheetClass || currentDetail
      const nextDrafts = syncDraftsWithItems(nextDetail?.feeItems, currentDrafts)
      setDetail(nextDetail)
      setDraftItems(nextDrafts)

      return { detail: nextDetail, drafts: nextDrafts, changed: true }
    } finally {
      setRowSaving(itemId, false)
    }
  }

  async function handleSaveRow(itemId) {
    try {
      const result = await saveItemDraft(itemId)
      if (result.changed) setSuccess('Đã lưu dòng dữ liệu')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể cập nhật fee item'))
    }
  }

  async function handleSaveAll() {
    const dirtyIds = Array.isArray(detail?.feeItems)
      ? detail.feeItems.filter((item) => isItemDirty(item, draftItems[item.id])).map((item) => item.id)
      : []

    if (dirtyIds.length === 0) return

    setSavingAll(true)
    setError('')

    let nextDetail = detail
    let nextDrafts = draftItems
    let savedCount = 0

    try {
      for (const itemId of dirtyIds) {
        const result = await saveItemDraft(itemId, { currentDetail: nextDetail, currentDrafts: nextDrafts })
        nextDetail = result.detail
        nextDrafts = result.drafts
        if (result.changed) savedCount += 1
      }

      if (savedCount > 0) setSuccess(`Đã lưu ${savedCount} dòng dữ liệu`)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu các fee item đã chỉnh sửa'))
    } finally {
      setSavingAll(false)
    }
  }

  async function handleSubmitForApproval() {
    if (!window.confirm('Bạn chắc chắn muốn gửi đề nghị phê duyệt bảng phí lớp này?')) return

    setSubmitting(true)
    setError('')
    try {
      const result = await submitMyFeeSheetClass(id)
      setDetail(result)
      setDraftItems(buildDraftMap(result?.feeItems))
      setSuccess('Đã gửi đề nghị phê duyệt')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể gửi đề nghị phê duyệt'))
    } finally {
      setSubmitting(false)
    }
  }

  function applyBulkQuantity() {
    const normalized = bulkQuantity.trim()
    if (!normalized || !Array.isArray(detail?.feeItems) || detail.feeItems.length === 0) return

    setDraftItems((prev) => {
      const next = { ...prev }
      detail.feeItems.forEach((item) => {
        next[item.id] = {
          ...(next[item.id] || createDraftItem(item)),
          quantity: normalized,
        }
      })
      return next
    })
    setSuccess('Đã áp dụng số lượng cho toàn bộ học viên')
  }

  function applyBulkUnitPrice() {
    const normalized = bulkUnitPrice.trim()
    if (!normalized || !Array.isArray(detail?.feeItems) || detail.feeItems.length === 0) return

    setDraftItems((prev) => {
      const next = { ...prev }
      detail.feeItems.forEach((item) => {
        next[item.id] = {
          ...(next[item.id] || createDraftItem(item)),
          unitPrice: normalized,
        }
      })
      return next
    })
    setSuccess('Đã áp dụng đơn giá cho toàn bộ học viên')
  }

  if (loading) {
    return (
      <div className='text-center py-5'>
        <CSpinner color='primary' />
      </div>
    )
  }

  const sheetStatus = formatStatus(detail?.status)
  const dirtyCount = Array.isArray(detail?.feeItems)
    ? detail.feeItems.filter((item) => isItemDirty(item, draftItems[item.id])).length
    : 0
  const editingItem = Array.isArray(detail?.feeItems)
    ? detail.feeItems.find((item) => item.id === editingItemId) || null
    : null

  return (
    <CRow className='g-0'>
      <CCol xs={12}>
        <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
          <div>
            <h3 className='mb-1'>{detail?.feeSheet?.name || 'Chi tiết bảng phí lớp'}</h3>
            <div className='text-body-secondary'>{detail?.classNameSnapshot || '-'} | {detail?.feeSheet?.fromDate || '-'} - {detail?.feeSheet?.toDate || '-'}</div>
          </div>
          <div className='d-flex gap-2 flex-wrap justify-content-end'>
            <CButton color='light' onClick={() => navigate('/my-fee-sheet-classes')}>Quay lại</CButton>
            <CButton color='primary' variant='outline' disabled={!detail?.canEdit || dirtyCount === 0 || savingAll} onClick={handleSaveAll}>{savingAll ? 'Đang lưu...' : `Lưu tất cả${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}</CButton>
            <CButton color='success' disabled={!detail?.canEdit || submitting || dirtyCount > 0 || savingAll} onClick={handleSubmitForApproval}>{submitting ? 'Đang gửi...' : 'Gửi duyệt'}</CButton>
          </div>
        </div>

        {success ? <CAlert color='success'>{success}</CAlert> : null}
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        {!detail?.canEdit ? <CAlert color='warning'>Bảng phí lớp này đã khóa nhập liệu. Bạn chỉ có thể xem dữ liệu hiện tại.</CAlert> : null}
        {detail?.canEdit && dirtyCount > 0 ? <CAlert color='info'>Có {dirtyCount} dòng đang có thay đổi chưa lưu. Hãy lưu trước khi gửi duyệt.</CAlert> : null}

        <CNav variant='tabs' role='tablist' className='mb-4'>
          <CNavItem>
            <CNavLink active={activeTab === 'info'} onClick={() => setActiveTab('info')} role='button'>Thông tin chung</CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink active={activeTab === 'entry'} onClick={() => setActiveTab('entry')} role='button'>Nhập liệu</CNavLink>
          </CNavItem>
        </CNav>

        <CTabContent>
          <CTabPane visible={activeTab === 'info'}>
            <CRow className='g-3 mb-4'>
              <CCol lg={8}>
                <CCard>
                  <CCardHeader><strong>Thông tin bảng phí</strong></CCardHeader>
                  <CCardBody>
                    <div className='mb-3'><strong>Bảng phí:</strong> {detail?.feeSheet?.name || '-'}</div>
                    <div className='mb-3'><strong>Từ ngày:</strong> {detail?.feeSheet?.fromDate || '-'}</div>
                    <div className='mb-3'><strong>Đến ngày:</strong> {detail?.feeSheet?.toDate || '-'}</div>
                    <div className='mb-3'><strong>Lớp:</strong> {detail?.classNameSnapshot || '-'}</div>
                    <div className='mb-3'><strong>Giáo viên:</strong> {detail?.teacherNameSnapshot || '-'}</div>
                    <div className='mb-3'><strong>Trạng thái lớp phí:</strong> <CBadge color={sheetStatus.color}>{sheetStatus.label}</CBadge></div>
                    <div><strong>Cho phép sửa:</strong> {detail?.canEdit ? 'Có' : 'Không'}</div>
                  </CCardBody>
                </CCard>
              </CCol>
              <CCol lg={4}>
                <CCard>
                  <CCardHeader><strong>Tổng quan nhập liệu</strong></CCardHeader>
                  <CCardBody>
                    <div className='mb-3'><strong>Số học viên:</strong> {detail?.feeItemsCount || 0}</div>
                    <div className='mb-3'><strong>Dòng chưa lưu:</strong> {dirtyCount}</div>
                    <div className='mb-3'><strong>Cho gửi duyệt:</strong> {detail?.canEdit && dirtyCount === 0 ? 'Có' : 'Không'}</div>
                    <div><strong>Cập nhật gần nhất:</strong> {detail?.updatedAt || '-'}</div>
                  </CCardBody>
                </CCard>
              </CCol>
            </CRow>
          </CTabPane>

          <CTabPane visible={activeTab === 'entry'}>
            <CCard className='mb-4'>
              <CCardHeader className='d-flex justify-content-between align-items-center gap-3 flex-wrap'>
                <strong>Khu vực nhập liệu</strong>
                {detail?.canEdit ? (
                  <div className='d-flex gap-3 flex-wrap align-items-end'>
                    <div>
                      <CFormLabel className='mb-1'>Áp số lượng chung</CFormLabel>
                      <CFormInput type='number' min={0} step='any' value={bulkQuantity} onChange={(event) => setBulkQuantity(event.target.value)} />
                    </div>
                    <CButton color='dark' variant='outline' onClick={applyBulkQuantity} disabled={!bulkQuantity.trim()}>Áp số lượng</CButton>
                    <div>
                      <CFormLabel className='mb-1'>Áp đơn giá chung</CFormLabel>
                      <CFormInput type='number' min={0} step='any' value={bulkUnitPrice} onChange={(event) => setBulkUnitPrice(event.target.value)} />
                    </div>
                    <CButton color='dark' variant='outline' onClick={applyBulkUnitPrice} disabled={!bulkUnitPrice.trim()}>Áp đơn giá</CButton>
                  </div>
                ) : null}
              </CCardHeader>
              <CCardBody>
                <CTable hover responsive>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Mã HS</CTableHeaderCell>
                      <CTableHeaderCell>Họ tên</CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: 130 }}>Số lượng</CTableHeaderCell>
                      <CTableHeaderCell>Đơn giá</CTableHeaderCell>
                      <CTableHeaderCell>% giảm</CTableHeaderCell>
                      <CTableHeaderCell>Giảm tiền</CTableHeaderCell>
                      <CTableHeaderCell>Thành tiền</CTableHeaderCell>
                      <CTableHeaderCell>Đã thu</CTableHeaderCell>
                      <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: 160 }}>Ghi chú</CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: 190 }}>Hành động</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {Array.isArray(detail?.feeItems) && detail.feeItems.length > 0 ? detail.feeItems.map((item) => {
                      const draft = draftItems[item.id] || createDraftItem(item)
                      const itemStatus = formatStatus(item.status)
                      const previewAmount = computePreviewAmount(draft)
                      const dirty = isItemDirty(item, draft)
                      const isSaving = Boolean(savingItemIds[item.id])

                      return (
                        <CTableRow key={item.id} color={dirty ? 'warning' : undefined}>
                          <CTableDataCell>
                            <div>{item.learnerCodeSnapshot || '-'}</div>
                            {dirty ? <CBadge color='warning' textColor='dark'>Chưa lưu</CBadge> : null}
                          </CTableDataCell>
                          <CTableDataCell>{item.learnerNameSnapshot || '-'}</CTableDataCell>
                          <CTableDataCell>
                            {detail?.canEdit ? (
                              <CFormInput
                                type='number'
                                min={0}
                                step='any'
                                value={draft.quantity}
                                onChange={(event) => updateDraftField(item.id, 'quantity', event.target.value)}
                              />
                            ) : draft.quantity}
                          </CTableDataCell>
                          <CTableDataCell>{formatCurrency(toNumber(draft.unitPrice))}</CTableDataCell>
                          <CTableDataCell>{toNumber(draft.discountPercent)}</CTableDataCell>
                          <CTableDataCell>{formatCurrency(toNumber(draft.discountAmount))}</CTableDataCell>
                          <CTableDataCell>
                            <strong>{formatCurrency(previewAmount)}</strong>
                          </CTableDataCell>
                          <CTableDataCell>{formatCurrency(item.paidAmount)}</CTableDataCell>
                          <CTableDataCell><CBadge color={itemStatus.color}>{itemStatus.label}</CBadge></CTableDataCell>
                          <CTableDataCell>{draft.note || '-'}</CTableDataCell>
                          <CTableDataCell>
                            <div className='d-flex gap-2 flex-wrap'>
                              <CButton size='sm' color='info' variant='outline' disabled={!detail?.canEdit} onClick={() => openEditModal(item)}>Sửa nâng cao</CButton>
                              <CButton size='sm' color='primary' variant='outline' disabled={!detail?.canEdit || !dirty || isSaving || savingAll} onClick={() => handleSaveRow(item.id)}>{isSaving ? 'Đang lưu...' : 'Lưu dòng'}</CButton>
                              <CButton size='sm' color='secondary' variant='outline' disabled={!detail?.canEdit || !dirty || isSaving || savingAll} onClick={() => resetDraftForItem(item)}>Hoàn tác</CButton>
                            </div>
                          </CTableDataCell>
                        </CTableRow>
                      )
                    }) : (
                      <CTableRow>
                        <CTableDataCell colSpan={11} className='text-center text-body-secondary'>Chưa có fee item</CTableDataCell>
                      </CTableRow>
                    )}
                  </CTableBody>
                </CTable>
              </CCardBody>
            </CCard>
          </CTabPane>
        </CTabContent>

        <CModal backdrop='static' visible={showModal} onClose={closeModal}>
          <CModalHeader>
            <CModalTitle>Sửa nâng cao: {editingItem?.learnerNameSnapshot || 'Fee item'}</CModalTitle>
          </CModalHeader>
          <CModalBody>
            <CForm>
              <CRow className='g-3'>
                <CCol md={6}>
                  <CFormLabel>Đơn giá</CFormLabel>
                  <CFormInput type='number' min={0} step='any' value={itemForm.unitPrice} onChange={(event) => setItemForm((prev) => ({ ...prev, unitPrice: event.target.value }))} />
                </CCol>
                <CCol md={6}>
                  <CFormLabel>Discount %</CFormLabel>
                  <CFormInput type='number' min={0} step='any' value={itemForm.discountPercent} onChange={(event) => setItemForm((prev) => ({ ...prev, discountPercent: event.target.value }))} />
                </CCol>
                <CCol md={6}>
                  <CFormLabel>Discount amount</CFormLabel>
                  <CFormInput type='number' min={0} step='any' value={itemForm.discountAmount} onChange={(event) => setItemForm((prev) => ({ ...prev, discountAmount: event.target.value }))} />
                </CCol>
                <CCol md={6}>
                  <CFormLabel>Số lượng hiện tại</CFormLabel>
                  <CFormInput value={itemForm.quantity} readOnly disabled />
                </CCol>
                <CCol md={12}>
                  <CFormLabel>Ghi chú</CFormLabel>
                  <CFormInput value={itemForm.note} onChange={(event) => setItemForm((prev) => ({ ...prev, note: event.target.value }))} />
                </CCol>
              </CRow>
            </CForm>
          </CModalBody>
          <CModalFooter>
            <CButton color='secondary' variant='outline' onClick={closeModal}>Hủy</CButton>
            <CButton color='primary' onClick={applyModalDraft}>Áp dụng</CButton>
          </CModalFooter>
        </CModal>
      </CCol>
    </CRow>
  )
}