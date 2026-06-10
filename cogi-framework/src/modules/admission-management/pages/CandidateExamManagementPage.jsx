import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CPagination,
  CPaginationItem,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CandidateExamFormModal from '../components/CandidateExamFormModal'
import CandidateExamImportModal from '../components/CandidateExamImportModal'
import CandidateExamLogModal from '../components/CandidateExamLogModal'
import CandidateExamScoreImportModal from '../components/CandidateExamScoreImportModal'
import {
	downloadCandidateExamImportTemplate,
  createCandidateExam,
  exportCandidateExams,
  getCandidateExamCardReminderSummary,
  getCandidateExamAdmissionSeasons,
  getCandidateExamLogs,
  getCandidateExams,
  restoreCandidateExam,
  sendCandidateExamCardRemindersDirect,
  softDeleteCandidateExam,
  updateCandidateExam,
} from '../services/admissionManagementService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function renderTruncatedText(value, options = {}) {
  const text = String(value || '').trim()
  if (!text) return '-'

  const maxWidth = options.maxWidth || '220px'
  const isLink = options.isLink === true
  const href = String(options.href || '').trim()
  const commonStyle = {
    display: 'inline-block',
    maxWidth,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    verticalAlign: 'bottom',
  }

  if (isLink && href) {
    return (
      <a href={href} target='_blank' rel='noreferrer' title={text} style={commonStyle}>
        {text}
      </a>
    )
  }

  return <span title={text} style={commonStyle}>{text}</span>
}

function getGenderLabel(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'male') return 'Nam'
  if (normalized === 'female') return 'Nữ'
  if (normalized === 'other') return 'Khác'
  return '-'
}

function getStatusLabel(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'draft') return 'Nháp'
  if (normalized === 'ready') return 'Sẵn sàng'
  if (normalized === 'card_downloaded') return 'Đã tải thẻ'
  if (normalized === 'checked_in') return 'Đã điểm danh'
  if (normalized === 'absent') return 'Vắng'
  if (normalized === 'completed') return 'Hoàn thành'
  if (normalized === 'cancelled') return 'Hủy'
  return normalized || '-'
}

function getStatusColor(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'ready' || normalized === 'completed') return 'success'
  if (normalized === 'card_downloaded' || normalized === 'checked_in') return 'info'
  if (normalized === 'absent' || normalized === 'cancelled') return 'danger'
  return 'secondary'
}

function getSeasonStatusColor(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'open') return 'success'
  if (normalized === 'closed') return 'secondary'
  return 'warning'
}

function getReminderStatusLabel(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'sending') return 'Đang gửi'
  if (normalized === 'queued') return 'Đang chờ gửi'
  if (normalized === 'sent') return 'Đã nhắc'
  if (normalized === 'failed') return 'Lỗi gửi'
  return 'Chưa nhắc'
}

function getReminderStatusColor(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'sending') return 'info'
  if (normalized === 'queued') return 'warning'
  if (normalized === 'sent') return 'success'
  if (normalized === 'failed') return 'danger'
  return 'secondary'
}

function buildReminderSummaryCards(summary) {
  return [
    { key: 'totalCandidates', label: 'Tổng thí sinh', value: Number(summary?.totalCandidates || 0), color: 'primary' },
    { key: 'viewedOrDownloadedCount', label: 'Đã xem/tải thẻ', value: Number(summary?.viewedOrDownloadedCount || 0), color: 'success' },
    { key: 'notViewedOrDownloadedCount', label: 'Chưa xem/tải thẻ', value: Number(summary?.notViewedOrDownloadedCount || 0), color: 'warning' },
    { key: 'scoreLookupCount', label: 'Đã xem điểm', value: Number(summary?.scoreLookupCount || 0), color: 'info' },
    { key: 'scoreNotLookupCount', label: 'Chưa xem điểm', value: Number(summary?.scoreNotLookupCount || 0), color: 'dark' },
    { key: 'reminderSentCount', label: 'Đã gửi nhắc', value: Number(summary?.reminderSentCount || 0), color: 'success' },
    { key: 'reminderPendingCount', label: 'Chưa gửi nhắc', value: Number(summary?.reminderPendingCount || 0), color: 'secondary' },
    { key: 'reminderFailedCount', label: 'Lỗi gửi', value: Number(summary?.reminderFailedCount || 0), color: 'danger' },
    { key: 'targetToReminderCount', label: 'Cần gửi nhắc', value: Number(summary?.targetToReminderCount || 0), color: 'info' },
  ]
}

function buildPages(currentPage, pageCount) {
  const pages = []
  const maxButtons = 5

  if (pageCount <= maxButtons) {
    for (let index = 1; index <= pageCount; index += 1) pages.push(index)
    return pages
  }

  const left = Math.max(2, currentPage - 1)
  const right = Math.min(pageCount - 1, currentPage + 1)

  pages.push(1)
  if (left > 2) pages.push('...')
  for (let index = left; index <= right; index += 1) pages.push(index)
  if (right < pageCount - 1) pages.push('...')
  pages.push(pageCount)
  return pages
}

export default function CandidateExamManagementPage() {
  const [seasonLoading, setSeasonLoading] = useState(true)
  const [seasonError, setSeasonError] = useState('')
  const [seasons, setSeasons] = useState([])
  const [selectedAdmissionSeason, setSelectedAdmissionSeason] = useState(null)

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [rows, setRows] = useState([])
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState('')
  const [reminderSummary, setReminderSummary] = useState(null)
  const [sendReminderModalVisible, setSendReminderModalVisible] = useState(false)
  const [sendReminderLimit, setSendReminderLimit] = useState('50')
  const [sendReminderSubmitting, setSendReminderSubmitting] = useState(false)
  const [sendReminderResult, setSendReminderResult] = useState(null)
  const [keywordDraft, setKeywordDraft] = useState('')
  const [keyword, setKeyword] = useState('')
  const [examRoomDraft, setExamRoomDraft] = useState('')
  const [examRoom, setExamRoom] = useState('')
  const [cardViewStatusDraft, setCardViewStatusDraft] = useState('')
  const [cardViewStatus, setCardViewStatus] = useState('')
  const [cardPrintStatusDraft, setCardPrintStatusDraft] = useState('')
  const [cardPrintStatus, setCardPrintStatus] = useState('')
  const [scoreLookupStatusDraft, setScoreLookupStatusDraft] = useState('')
  const [scoreLookupStatus, setScoreLookupStatus] = useState('')
  const [sortBy, setSortBy] = useState('')
  const [sortOrder, setSortOrder] = useState('desc')
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [scoreImportModalVisible, setScoreImportModalVisible] = useState(false)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [logModalVisible, setLogModalVisible] = useState(false)
  const [logModalTitle, setLogModalTitle] = useState('')
  const [logLoading, setLogLoading] = useState(false)
  const [logError, setLogError] = useState('')
  const [logRows, setLogRows] = useState([])

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [pageSize, total])
  const pages = useMemo(() => buildPages(page, pageCount), [page, pageCount])
  const fromToText = useMemo(() => {
    if (total === 0) return '0'
    const from = (page - 1) * pageSize + 1
    const to = Math.min(page * pageSize, total)
    return `${from}-${to}/${total}`
  }, [page, pageSize, total])

  const loadSeasons = useCallback(async () => {
    setSeasonLoading(true)
    setSeasonError('')

    try {
      const data = await getCandidateExamAdmissionSeasons()
      setSeasons(Array.isArray(data) ? data : [])
    } catch (requestError) {
      setSeasons([])
      setSeasonError(getApiMessage(requestError, 'Không tải được danh sách kỳ tuyển sinh'))
    } finally {
      setSeasonLoading(false)
    }
  }, [])

  const loadData = useCallback(async () => {
    if (!selectedAdmissionSeason?.id) return

    setLoading(true)
    setError('')
    try {
      const result = await getCandidateExams({
        admissionSeasonId: selectedAdmissionSeason.id,
        keyword: keyword || undefined,
        examRoom: examRoom || undefined,
        cardViewStatus: cardViewStatus || undefined,
        cardPrintStatus: cardPrintStatus || undefined,
        scoreLookupStatus: scoreLookupStatus || undefined,
        sortBy: sortBy || undefined,
        sortOrder: sortBy ? sortOrder : undefined,
        includeDeleted,
        page,
        pageSize,
      })

      setRows(Array.isArray(result?.items) ? result.items : [])
      setTotal(Number(result?.total || 0))
      setPage(Number(result?.page || page))
      setPageSize(Number(result?.pageSize || pageSize))
    } catch (requestError) {
      setRows([])
      setTotal(0)
      setError(getApiMessage(requestError, 'Không tải được danh sách thí sinh dự kiểm tra'))
    } finally {
      setLoading(false)
    }
  }, [cardPrintStatus, cardViewStatus, examRoom, includeDeleted, keyword, page, pageSize, scoreLookupStatus, selectedAdmissionSeason?.id, sortBy, sortOrder])

  const loadReminderSummary = useCallback(async () => {
    if (!selectedAdmissionSeason?.id) return

    setSummaryLoading(true)
    setSummaryError('')
    try {
      const data = await getCandidateExamCardReminderSummary(selectedAdmissionSeason.id)
      setReminderSummary(data || null)
    } catch (requestError) {
      setReminderSummary(null)
      setSummaryError(getApiMessage(requestError, 'Không tải được thống kê nhắc tải thẻ'))
    } finally {
      setSummaryLoading(false)
    }
  }, [selectedAdmissionSeason?.id])

  useEffect(() => {
    loadSeasons()
  }, [loadSeasons])

  useEffect(() => {
    if (!selectedAdmissionSeason?.id) return
    loadData()
  }, [loadData, selectedAdmissionSeason?.id])

  useEffect(() => {
    if (!selectedAdmissionSeason?.id) return
    loadReminderSummary()
  }, [loadReminderSummary, selectedAdmissionSeason?.id])

  useEffect(() => {
    if (!successMessage) return undefined
    const timer = window.setTimeout(() => setSuccessMessage(''), 2500)
    return () => window.clearTimeout(timer)
  }, [successMessage])

  function handleSelectSeason(season) {
    setSelectedAdmissionSeason(season)
    setRows([])
    setKeywordDraft('')
    setKeyword('')
    setExamRoomDraft('')
    setExamRoom('')
    setCardViewStatusDraft('')
    setCardViewStatus('')
    setCardPrintStatusDraft('')
    setCardPrintStatus('')
    setScoreLookupStatusDraft('')
    setScoreLookupStatus('')
    setSortBy('')
    setSortOrder('desc')
    setIncludeDeleted(false)
    setPage(1)
    setPageSize(10)
    setTotal(0)
    setError('')
    setSuccessMessage('')
    setSummaryError('')
    setReminderSummary(null)
    setSendReminderResult(null)
    setImportModalVisible(false)
    setScoreImportModalVisible(false)
  }

  function handleBackToSeasonSelection() {
    setSelectedAdmissionSeason(null)
    setRows([])
    setError('')
    setSuccessMessage('')
    setShowModal(false)
    setEditingRow(null)
    setImportModalVisible(false)
    setScoreImportModalVisible(false)
    setReminderSummary(null)
    setSummaryError('')
    setSendReminderResult(null)
  }

  function applySearch() {
    setPage(1)
    setKeyword(String(keywordDraft || '').trim())
    setExamRoom(String(examRoomDraft || '').trim())
    setCardViewStatus(String(cardViewStatusDraft || '').trim())
    setCardPrintStatus(String(cardPrintStatusDraft || '').trim())
    setScoreLookupStatus(String(scoreLookupStatusDraft || '').trim())
  }

  function resetFilters() {
    setKeywordDraft('')
    setKeyword('')
    setExamRoomDraft('')
    setExamRoom('')
    setCardViewStatusDraft('')
    setCardViewStatus('')
    setCardPrintStatusDraft('')
    setCardPrintStatus('')
    setScoreLookupStatusDraft('')
    setScoreLookupStatus('')
    setSortBy('')
    setSortOrder('desc')
    setIncludeDeleted(false)
    setPage(1)
  }

  function openCreateModal() {
    setEditingRow(null)
    setShowModal(true)
  }

  function openSendReminderModal() {
    setSendReminderLimit('50')
    setSendReminderModalVisible(true)
  }

  async function handleDownloadImportTemplate() {
    setError('')
    setDownloadingTemplate(true)
    try {
      const result = await downloadCandidateExamImportTemplate()
      const blob = result?.blob instanceof Blob
        ? result.blob
        : new Blob([result?.blob], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          })

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result?.fileName || 'candidate-exam-import-template.xlsx'
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể tải file mẫu import Excel'))
    } finally {
      setDownloadingTemplate(false)
    }
  }

  async function handleExportExcel() {
    if (!selectedAdmissionSeason?.id) return

    setError('')
    setExportingExcel(true)
    try {
      const result = await exportCandidateExams({
        admissionSeasonId: selectedAdmissionSeason.id,
        keyword: keyword || undefined,
        examRoom: examRoom || undefined,
        cardViewStatus: cardViewStatus || undefined,
        cardPrintStatus: cardPrintStatus || undefined,
        scoreLookupStatus: scoreLookupStatus || undefined,
        sortBy: sortBy || undefined,
        sortOrder: sortBy ? sortOrder : undefined,
        includeDeleted,
      })

      const blob = result?.blob instanceof Blob
        ? result.blob
        : new Blob([result?.blob], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          })

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result?.fileName || 'candidate-exams.xlsx'
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể xuất Excel danh sách thí sinh'))
    } finally {
      setExportingExcel(false)
    }
  }

  function openEditModal(row) {
    setEditingRow(row)
    setShowModal(true)
  }

  async function handleSubmit(payload) {
    setSubmitting(true)
    setError('')
    setSuccessMessage('')
    try {
      if (editingRow?.id) {
        await updateCandidateExam(editingRow.id, payload)
        setSuccessMessage('Cập nhật thí sinh dự kiểm tra thành công')
      } else {
        await createCandidateExam(payload)
        setSuccessMessage('Thêm thí sinh dự kiểm tra thành công')
      }

      setShowModal(false)
      setEditingRow(null)
      await Promise.all([loadData(), loadReminderSummary()])
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu thí sinh dự kiểm tra'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirmSendReminder() {
    if (!selectedAdmissionSeason?.id) return

    setSendReminderSubmitting(true)
    setError('')
    setSuccessMessage('')
    try {
      const result = await sendCandidateExamCardRemindersDirect({
        admissionCampaignId: selectedAdmissionSeason.id,
        limit: Number(sendReminderLimit || 50) || 50,
      })

      setSendReminderResult(result || null)
      setSuccessMessage(`Đã xử lý gửi nhắc tải thẻ cho ${Number(result?.processedCount || 0)} thí sinh.`)
      setSendReminderModalVisible(false)
      await Promise.all([loadReminderSummary(), loadData()])
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể gửi email nhắc tải thẻ'))
    } finally {
      setSendReminderSubmitting(false)
    }
  }

  async function handleSoftDelete(row) {
    if (!row?.id) return
    const confirmed = window.confirm(`Xóa mềm thí sinh ${row.fullName || row.applicationCode || row.id}?`)
    if (!confirmed) return

    setError('')
    setSuccessMessage('')
    try {
      await softDeleteCandidateExam(row.id)
      setSuccessMessage('Đã xóa mềm thí sinh dự kiểm tra')
      await Promise.all([loadData(), loadReminderSummary()])
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể xóa mềm thí sinh dự kiểm tra'))
    }
  }

  async function handleRestore(row) {
    if (!row?.id) return
    const confirmed = window.confirm(`Khôi phục thí sinh ${row.fullName || row.applicationCode || row.id}?`)
    if (!confirmed) return

    setError('')
    setSuccessMessage('')
    try {
      await restoreCandidateExam(row.id)
      setSuccessMessage('Đã khôi phục thí sinh dự kiểm tra')
      await Promise.all([loadData(), loadReminderSummary()])
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể khôi phục thí sinh dự kiểm tra'))
    }
  }

  async function handleOpenLogs(row) {
    if (!row?.id) return
    setLogModalVisible(true)
    setLogModalTitle(`Lịch sử thao tác - ${row.fullName || row.applicationCode || row.id}`)
    setLogLoading(true)
    setLogError('')
    setLogRows([])

    try {
      const data = await getCandidateExamLogs(row.id)
      setLogRows(Array.isArray(data) ? data : [])
    } catch (requestError) {
      setLogRows([])
      setLogError(getApiMessage(requestError, 'Không tải được lịch sử thao tác'))
    } finally {
      setLogLoading(false)
    }
  }

  function handleOpenExamCard(row) {
    if (!row?.id) return
    const targetUrl = `/admission/candidate-exams/${row.id}/exam-card`
    const openedWindow = window.open(targetUrl, '_blank')
    openedWindow?.focus?.()
  }

  if (!selectedAdmissionSeason) {
    return (
      <CRow className='g-4'>
        <CCol xs={12}>
          <CCard>
            <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-3'>
              <strong>Chọn kỳ tuyển sinh</strong>
              <CButton color='secondary' variant='outline' onClick={loadSeasons} disabled={seasonLoading}>Tải lại</CButton>
            </CCardHeader>
            <CCardBody>
              {seasonError ? <CAlert color='danger'>{seasonError}</CAlert> : null}

              {seasonLoading ? (
                <div className='d-flex align-items-center gap-2'>
                  <CSpinner size='sm' />
                  <span>Đang tải danh sách kỳ tuyển sinh...</span>
                </div>
              ) : Array.isArray(seasons) && seasons.length > 0 ? (
                <CTable hover responsive align='middle'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Tên kỳ tuyển sinh</CTableHeaderCell>
                      <CTableHeaderCell>Mã</CTableHeaderCell>
                      <CTableHeaderCell>Năm học</CTableHeaderCell>
                      <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                      <CTableHeaderCell className='text-end'>Thao tác</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {seasons.map((item) => (
                      <CTableRow key={item.id}>
                        <CTableDataCell>{item.name || '-'}</CTableDataCell>
                        <CTableDataCell>{item.code || '-'}</CTableDataCell>
                        <CTableDataCell>{item.schoolYear || '-'}</CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={getSeasonStatusColor(item.status)}>{item.status || 'draft'}</CBadge>
                        </CTableDataCell>
                        <CTableDataCell className='text-end'>
                          <CButton color='primary' onClick={() => handleSelectSeason(item)}>Quản lý thí sinh</CButton>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              ) : (
                <CAlert color='info' className='mb-0'>Tenant hiện tại chưa có kỳ tuyển sinh nào.</CAlert>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    )
  }

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard>
          <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-3'>
            <strong>Quản lý thí sinh dự kiểm tra - {selectedAdmissionSeason?.name || '-'}</strong>
            <div className='d-flex gap-2 flex-wrap'>
              <CButton color='secondary' variant='outline' onClick={handleBackToSeasonSelection}>Quay lại chọn kỳ tuyển sinh</CButton>
              <CButton color='dark' variant='outline' onClick={openSendReminderModal} disabled={loading || summaryLoading || sendReminderSubmitting}>
                Gửi email nhắc PH chưa tải thẻ
              </CButton>
              <CButton color='success' variant='outline' onClick={handleExportExcel} disabled={loading || exportingExcel}>
                {exportingExcel ? 'Đang xuất Excel...' : 'Xuất Excel'}
              </CButton>
              <CButton color='secondary' variant='outline' onClick={handleDownloadImportTemplate} disabled={downloadingTemplate || loading}>
                {downloadingTemplate ? 'Đang tải mẫu...' : 'Tải mẫu thí sinh'}
              </CButton>
              <CButton color='info' variant='outline' onClick={() => setImportModalVisible(true)} disabled={loading}>Import thí sinh</CButton>
              <CButton color='warning' variant='outline' onClick={() => setScoreImportModalVisible(true)} disabled={loading}>Import điểm</CButton>
              <CButton color='secondary' variant='outline' onClick={loadData} disabled={loading}>Tải lại</CButton>
              <CButton color='primary' onClick={openCreateModal}>Thêm thí sinh</CButton>
            </div>
          </CCardHeader>
          <CCardBody>
            {summaryError ? <CAlert color='danger'>{summaryError}</CAlert> : null}
            {sendReminderResult ? (
              <CAlert color='info'>
                <div>Đã gửi thành công: {Number(sendReminderResult?.sentCount || 0)}</div>
                <div>Lỗi: {Number(sendReminderResult?.failedCount || 0)}</div>
                <div>Không có email: {Number(sendReminderResult?.skippedNoEmail || 0)}</div>
                <div>Còn lại: {Number(sendReminderResult?.remainingCount || 0)}</div>
                {Number(sendReminderResult?.remainingCount || 0) > 0 ? (
                  <div className='mt-1'>Còn {Number(sendReminderResult?.remainingCount || 0)} phụ huynh có thể gửi nhắc ở lượt tiếp theo.</div>
                ) : null}
                {Array.isArray(sendReminderResult?.errors) && sendReminderResult.errors.length > 0 ? (
                  <div className='mt-2 small'>
                    {sendReminderResult.errors.map((item, index) => (
                      <div key={`send-reminder-error-${index}`}>{`${item?.fullName || '-'} (${item?.studentCode || '-'}/${item?.applicationCode || '-'}) - ${item?.errorMessage || 'Lỗi gửi email'}`}</div>
                    ))}
                  </div>
                ) : null}
              </CAlert>
            ) : null}

            <CRow className='g-3 mb-4'>
              {summaryLoading ? (
                <CCol xs={12}>
                  <div className='d-flex align-items-center gap-2'>
                    <CSpinner size='sm' />
                    <span>Đang tải thống kê nhắc tải thẻ...</span>
                  </div>
                </CCol>
              ) : buildReminderSummaryCards(reminderSummary).map((item) => (
                <CCol key={item.key} xs={12} sm={6} xl={3} xxl={Math.max(2, 12 / 7)}>
                  <CCard className='h-100 border-top border-3' style={{ borderTopColor: `var(--cui-${item.color})` }}>
                    <CCardBody>
                      <div className='text-body-secondary small'>{item.label}</div>
                      <div className='fs-4 fw-semibold'>{item.value}</div>
                    </CCardBody>
                  </CCard>
                </CCol>
              ))}
            </CRow>

            <CRow className='g-3 mb-3'>
              <CCol md={4}>
                <CFormInput
                  placeholder='Tìm theo mã học sinh, mã hồ sơ, họ tên'
                  value={keywordDraft}
                  onChange={(event) => setKeywordDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applySearch()
                  }}
                />
              </CCol>
              <CCol md={3}>
                <CFormInput
                  placeholder='Lọc theo phòng kiểm tra'
                  value={examRoomDraft}
                  onChange={(event) => setExamRoomDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applySearch()
                  }}
                />
              </CCol>
              <CCol md={2} className='d-flex align-items-center'>
                <CFormCheck
                  id='candidate-exam-include-deleted'
                  label='Hiển thị bản ghi đã xóa'
                  checked={includeDeleted}
                  onChange={(event) => {
                    setIncludeDeleted(event.target.checked)
                    setPage(1)
                  }}
                />
              </CCol>
              <CCol md={2}>
                <CFormSelect value={cardViewStatusDraft} onChange={(event) => setCardViewStatusDraft(event.target.value)}>
                  <option value=''>PH xem thẻ: tất cả</option>
                  <option value='viewed'>Phụ huynh đã xem thẻ</option>
                  <option value='not_viewed'>Phụ huynh chưa xem thẻ</option>
                </CFormSelect>
              </CCol>
              <CCol md={2}>
                <CFormSelect value={cardPrintStatusDraft} onChange={(event) => setCardPrintStatusDraft(event.target.value)}>
                  <option value=''>In thẻ: tất cả</option>
                  <option value='printed'>Đã in thẻ</option>
                  <option value='not_printed'>Chưa in thẻ</option>
                </CFormSelect>
              </CCol>
              <CCol md={2}>
                <CFormSelect value={scoreLookupStatusDraft} onChange={(event) => setScoreLookupStatusDraft(event.target.value)}>
                  <option value=''>Xem điểm: tất cả</option>
                  <option value='looked_up'>Đã xem điểm</option>
                  <option value='not_looked_up'>Chưa xem điểm</option>
                </CFormSelect>
              </CCol>
              <CCol md={2}>
                <CFormSelect value={sortBy} onChange={(event) => { setPage(1); setSortBy(event.target.value) }}>
                  <option value=''>Sắp xếp mặc định</option>
                  <option value='cardFirstViewedAt'>Theo lần đầu phụ huynh xem thẻ</option>
                  <option value='cardFirstPrintedAt'>Theo lần đầu in thẻ</option>
                </CFormSelect>
              </CCol>
              <CCol md={2}>
                <CFormSelect value={sortOrder} onChange={(event) => { setPage(1); setSortOrder(event.target.value || 'desc') }} disabled={!sortBy}>
                  <option value='desc'>Mới nhất trước</option>
                  <option value='asc'>Cũ nhất trước</option>
                </CFormSelect>
              </CCol>
              <CCol md={1}>
                <CFormSelect value={pageSize} onChange={(event) => { setPage(1); setPageSize(Number(event.target.value) || 10) }}>
                  <option value={10}>10 / trang</option>
                  <option value={20}>20 / trang</option>
                  <option value={50}>50 / trang</option>
                </CFormSelect>
              </CCol>
              <CCol md={2} className='d-flex gap-2'>
                <CButton color='primary' className='w-100' onClick={applySearch} disabled={loading}>Tìm kiếm</CButton>
                <CButton color='secondary' variant='outline' onClick={resetFilters} disabled={loading}>Xóa lọc</CButton>
              </CCol>
            </CRow>

            {error ? <CAlert color='danger'>{error}</CAlert> : null}
            {successMessage ? <CAlert color='success'>{successMessage}</CAlert> : null}

            {loading ? (
              <div className='d-flex align-items-center gap-2'>
                <CSpinner size='sm' />
                <span>Đang tải dữ liệu...</span>
              </div>
            ) : (
              <>
                <CTable hover responsive align='middle'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>STT</CTableHeaderCell>
                      <CTableHeaderCell>Mã học sinh</CTableHeaderCell>
                      <CTableHeaderCell>Mã hồ sơ</CTableHeaderCell>
                      <CTableHeaderCell>Họ tên</CTableHeaderCell>
                      <CTableHeaderCell>Ảnh thẻ</CTableHeaderCell>
                      <CTableHeaderCell>Ngày sinh</CTableHeaderCell>
                      <CTableHeaderCell>Giới tính</CTableHeaderCell>
                      <CTableHeaderCell>Trường tiểu học</CTableHeaderCell>
                      <CTableHeaderCell>Số báo danh</CTableHeaderCell>
                      <CTableHeaderCell>Địa điểm kiểm tra</CTableHeaderCell>
                      <CTableHeaderCell>Phòng kiểm tra</CTableHeaderCell>
                      <CTableHeaderCell>Lần đầu PH xem thẻ</CTableHeaderCell>
                      <CTableHeaderCell>Lần đầu in thẻ</CTableHeaderCell>
                      <CTableHeaderCell>Trạng thái nhắc</CTableHeaderCell>
                      <CTableHeaderCell>Lần nhắc gần nhất</CTableHeaderCell>
                      <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                      <CTableHeaderCell>Tải thẻ</CTableHeaderCell>
                      <CTableHeaderCell className='text-end'>Thao tác</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length > 0 ? rows.map((item, index) => (
                      <CTableRow key={item.id} style={item?.isDeleted ? { opacity: 0.65, backgroundColor: 'rgba(108, 117, 125, 0.08)' } : undefined}>
                        <CTableDataCell>{(page - 1) * pageSize + index + 1}</CTableDataCell>
                        <CTableDataCell>{item.studentCode || '-'}</CTableDataCell>
                        <CTableDataCell>{item.applicationCode || '-'}</CTableDataCell>
                        <CTableDataCell>{item.fullName || '-'}</CTableDataCell>
                        <CTableDataCell className='small'>
                          {item.cardImagePath ? (
                            renderTruncatedText(item.cardImagePath, { isLink: true, href: item.cardImagePath, maxWidth: '180px' })
                          ) : '-'}
                        </CTableDataCell>
                        <CTableDataCell>{formatDate(item.dateOfBirth)}</CTableDataCell>
                        <CTableDataCell>{getGenderLabel(item.gender)}</CTableDataCell>
                        <CTableDataCell>{item.primarySchool || '-'}</CTableDataCell>
                        <CTableDataCell>{item.candidateNumber || '-'}</CTableDataCell>
                        <CTableDataCell>{renderTruncatedText(item.examLocation, { maxWidth: '220px' })}</CTableDataCell>
                        <CTableDataCell>{item.examRoom || '-'}</CTableDataCell>
                        <CTableDataCell>{formatDateTime(item.cardFirstViewedAt)}</CTableDataCell>
                        <CTableDataCell>{formatDateTime(item.cardFirstPrintedAt)}</CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={getReminderStatusColor(item.cardReminderStatus)}>{getReminderStatusLabel(item.cardReminderStatus)}</CBadge>
                        </CTableDataCell>
                        <CTableDataCell>{item.cardReminderSentAt ? formatDateTime(item.cardReminderSentAt) : 'Chưa'}</CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={getStatusColor(item.candidateExamStatus)}>{getStatusLabel(item.candidateExamStatus)}</CBadge>
                          {item?.isDeleted ? <CBadge color='dark' className='ms-2'>Đã xóa</CBadge> : null}
                        </CTableDataCell>
                        <CTableDataCell>{item.cardDownloadCount || 0}</CTableDataCell>
                        <CTableDataCell className='text-end'>
                          <div className='d-inline-flex gap-2 flex-wrap justify-content-end'>
                            <CButton size='sm' color='info' variant='outline' onClick={() => handleOpenExamCard(item)}>Xem thẻ</CButton>
                            <CButton size='sm' color='info' variant='outline' onClick={() => handleOpenLogs(item)}>Xem log</CButton>
                            {!item?.isDeleted ? (
                              <>
                                <CButton size='sm' color='warning' variant='outline' onClick={() => openEditModal(item)}>Sửa</CButton>
                                <CButton size='sm' color='danger' variant='outline' onClick={() => handleSoftDelete(item)}>Xóa mềm</CButton>
                              </>
                            ) : (
                              <CButton size='sm' color='success' variant='outline' onClick={() => handleRestore(item)}>Khôi phục</CButton>
                            )}
                          </div>
                        </CTableDataCell>
                      </CTableRow>
                    )) : (
                      <CTableRow>
                        <CTableDataCell colSpan={18} className='text-center text-body-secondary'>Không có thí sinh phù hợp</CTableDataCell>
                      </CTableRow>
                    )}
                  </CTableBody>
                </CTable>

                <div className='d-flex justify-content-between align-items-center flex-wrap gap-3 mt-3'>
                  <div className='text-body-secondary small'>Hiển thị {fromToText}</div>
                  <CPagination align='end' className='mb-0'>
                    <CPaginationItem disabled={page <= 1 || loading} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Trước</CPaginationItem>
                    {pages.map((item, index) => typeof item === 'string'
                      ? <CPaginationItem key={`dots-${index}`} disabled>…</CPaginationItem>
                      : <CPaginationItem key={item} active={item === page} disabled={loading} onClick={() => setPage(item)}>{item}</CPaginationItem>)}
                    <CPaginationItem disabled={page >= pageCount || loading} onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}>Sau</CPaginationItem>
                  </CPagination>
                </div>
              </>
            )}
          </CCardBody>
        </CCard>
      </CCol>

      <CandidateExamFormModal
        visible={showModal}
        initialValues={editingRow}
        admissionSeason={selectedAdmissionSeason}
        onClose={() => {
          if (submitting) return
          setShowModal(false)
          setEditingRow(null)
        }}
        onSubmit={handleSubmit}
        submitting={submitting}
      />

      <CandidateExamImportModal
        visible={importModalVisible}
        admissionSeason={selectedAdmissionSeason}
        onClose={() => setImportModalVisible(false)}
        onImported={async (result) => {
          setImportModalVisible(false)
          setSuccessMessage(
            `Import hoàn tất: tạo mới ${result?.summary?.createdCount || 0}, cập nhật ${result?.summary?.updatedCount || 0}, khôi phục ${result?.summary?.restoredCount || 0}, lỗi ${result?.summary?.errorCount || 0}`
          )
          await Promise.all([loadData(), loadReminderSummary()])
        }}
      />

      <CandidateExamScoreImportModal
        visible={scoreImportModalVisible}
        admissionSeason={selectedAdmissionSeason}
        onClose={() => setScoreImportModalVisible(false)}
        onImported={async (result) => {
          setScoreImportModalVisible(false)
          setSuccessMessage(
            `Import điểm hoàn tất: cập nhật ${result?.summary?.updatedCount || 0}, bỏ qua ${result?.summary?.skippedCount || 0}, lỗi ${result?.summary?.errorCount || 0}`
          )
          await Promise.all([loadData(), loadReminderSummary()])
        }}
      />

      <CandidateExamLogModal
        visible={logModalVisible}
        title={logModalTitle}
        loading={logLoading}
        error={logError}
        logs={logRows}
        onClose={() => {
          if (logLoading) return
          setLogModalVisible(false)
          setLogModalTitle('')
          setLogRows([])
          setLogError('')
        }}
      />

      <CModal visible={sendReminderModalVisible} onClose={() => !sendReminderSubmitting && setSendReminderModalVisible(false)} backdrop='static'>
        <CModalHeader>
          <CModalTitle>Gửi email nhắc tải thẻ</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p className='mb-3'>Hệ thống sẽ gửi email trực tiếp trong lượt này cho các phụ huynh chưa xem/tải thẻ và chưa từng được nhắc.</p>
          <CFormLabel>Số lượng gửi trong lượt</CFormLabel>
          <CFormSelect value={sendReminderLimit} onChange={(event) => setSendReminderLimit(event.target.value)} disabled={sendReminderSubmitting}>
            <option value='20'>20</option>
            <option value='50'>50</option>
            <option value='100'>100</option>
          </CFormSelect>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setSendReminderModalVisible(false)} disabled={sendReminderSubmitting}>Hủy</CButton>
          <CButton color='primary' onClick={handleConfirmSendReminder} disabled={sendReminderSubmitting}>
            {sendReminderSubmitting ? 'Đang gửi...' : 'Xác nhận gửi'}
          </CButton>
        </CModalFooter>
      </CModal>
    </CRow>
  )
}