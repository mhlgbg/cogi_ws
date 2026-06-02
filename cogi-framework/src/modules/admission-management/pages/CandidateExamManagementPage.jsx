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
  CFormSelect,
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
import {
	downloadCandidateExamImportTemplate,
  createCandidateExam,
  getCandidateExamAdmissionSeasons,
  getCandidateExamLogs,
  getCandidateExams,
  restoreCandidateExam,
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
  const [keywordDraft, setKeywordDraft] = useState('')
  const [keyword, setKeyword] = useState('')
  const [examRoomDraft, setExamRoomDraft] = useState('')
  const [examRoom, setExamRoom] = useState('')
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
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
  }, [examRoom, includeDeleted, keyword, page, pageSize, selectedAdmissionSeason?.id])

  useEffect(() => {
    loadSeasons()
  }, [loadSeasons])

  useEffect(() => {
    if (!selectedAdmissionSeason?.id) return
    loadData()
  }, [loadData, selectedAdmissionSeason?.id])

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
    setIncludeDeleted(false)
    setPage(1)
    setPageSize(10)
    setTotal(0)
    setError('')
    setSuccessMessage('')
  }

  function handleBackToSeasonSelection() {
    setSelectedAdmissionSeason(null)
    setRows([])
    setError('')
    setSuccessMessage('')
    setShowModal(false)
    setEditingRow(null)
  }

  function applySearch() {
    setPage(1)
    setKeyword(String(keywordDraft || '').trim())
    setExamRoom(String(examRoomDraft || '').trim())
  }

  function resetFilters() {
    setKeywordDraft('')
    setKeyword('')
    setExamRoomDraft('')
    setExamRoom('')
    setIncludeDeleted(false)
    setPage(1)
  }

  function openCreateModal() {
    setEditingRow(null)
    setShowModal(true)
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
      await loadData()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu thí sinh dự kiểm tra'))
    } finally {
      setSubmitting(false)
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
      await loadData()
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
      await loadData()
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
              <CButton color='secondary' variant='outline' onClick={handleDownloadImportTemplate} disabled={downloadingTemplate || loading}>
                {downloadingTemplate ? 'Đang tải mẫu...' : 'Tải file mẫu'}
              </CButton>
              <CButton color='info' variant='outline' onClick={() => setImportModalVisible(true)} disabled={loading}>Import Excel</CButton>
              <CButton color='secondary' variant='outline' onClick={loadData} disabled={loading}>Tải lại</CButton>
              <CButton color='primary' onClick={openCreateModal}>Thêm thí sinh</CButton>
            </div>
          </CCardHeader>
          <CCardBody>
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
                      <CTableHeaderCell>Điểm TV</CTableHeaderCell>
                      <CTableHeaderCell>Điểm Anh</CTableHeaderCell>
                      <CTableHeaderCell>Điểm Toán</CTableHeaderCell>
                      <CTableHeaderCell>Điểm khuyến khích</CTableHeaderCell>
                      <CTableHeaderCell>Tổng điểm</CTableHeaderCell>
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
                            <a href={item.cardImagePath} target='_blank' rel='noreferrer'>{item.cardImagePath}</a>
                          ) : '-'}
                        </CTableDataCell>
                        <CTableDataCell>{formatDate(item.dateOfBirth)}</CTableDataCell>
                        <CTableDataCell>{getGenderLabel(item.gender)}</CTableDataCell>
                        <CTableDataCell>{item.primarySchool || '-'}</CTableDataCell>
                        <CTableDataCell>{item.candidateNumber || '-'}</CTableDataCell>
                        <CTableDataCell>{item.examLocation || '-'}</CTableDataCell>
                        <CTableDataCell>{item.examRoom || '-'}</CTableDataCell>
                        <CTableDataCell>{item.vietnameseScore ?? '-'}</CTableDataCell>
                        <CTableDataCell>{item.englishScore ?? '-'}</CTableDataCell>
                        <CTableDataCell>{item.mathScore ?? '-'}</CTableDataCell>
                        <CTableDataCell>{item.incentiveScore ?? 0}</CTableDataCell>
                        <CTableDataCell>{item.totalScore ?? '-'}</CTableDataCell>
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
                        <CTableDataCell colSpan={19} className='text-center text-body-secondary'>Không có thí sinh phù hợp</CTableDataCell>
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
          await loadData()
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
    </CRow>
  )
}