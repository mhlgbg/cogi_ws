import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
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
  CNav,
  CNavItem,
  CNavLink,
  CRow,
  CSpinner,
} from '@coreui/react'
import { getLearningManagementBootstrap } from '../../learning-management/services/learningObjectApi'
import AssessmentEditorModal from '../components/AssessmentEditorModal'
import AssessmentPreview from '../components/AssessmentPreview'
import AssessmentPlacementRulesTab from '../components/AssessmentPlacementRulesTab'
import AssessmentSpeakingCriteriaTab from '../components/AssessmentSpeakingCriteriaTab'
import AssessmentQuestionEditorModal from '../components/AssessmentQuestionEditorModal'
import AssessmentQuestionPickerModal from '../components/AssessmentQuestionPickerModal'
import AssessmentSectionEditorModal from '../components/AssessmentSectionEditorModal'
import AssessmentValidationSummary from '../components/AssessmentValidationSummary'
import AssessmentVersionEditorModal from '../components/AssessmentVersionEditorModal'
import {
  addAssessmentQuestion,
  cloneAssessmentVersion,
  createAssessmentSection,
  createAssessmentVersion,
  deleteAssessmentSection,
  deleteAssessmentVersion,
  getApiMessage,
  getAssessment,
  getAssessmentVersion,
  publishAssessmentVersion,
  removeAssessmentQuestion,
  reorderAssessmentQuestions,
  reorderAssessmentSections,
  retireAssessmentVersion,
  updateAssessment,
  updateAssessmentQuestion,
  updateAssessmentSection,
  updateAssessmentVersion,
  validateAssessmentVersion,
} from '../services/assessmentService'
import {
  computeSectionStats,
  computeVersionStats,
  formatCandidateRange,
  formatDateTime,
  formatGradeRange,
  getAssessmentStatusLabel,
  getAssessmentTypeLabel,
  getEntityId,
  getQuestionTypeLabel,
  getRuntimeConfigSummary,
  getStatusBadgeColor,
  getVersionStatusLabel,
  truncateText,
} from '../components/assessmentUi'

const TABS = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'versions', label: 'Phiên bản' },
  { key: 'structure', label: 'Cấu trúc đề' },
  { key: 'speaking-config', label: 'Cấu hình Speaking' },
  { key: 'placement-rules', label: 'Quy tắc xếp mức' },
  { key: 'preview', label: 'Xem trước' },
]

function buildCloneDraft(version) {
  if (!version) return null
  return {
    ...version,
    code: version.code ? `${version.code}-COPY` : '',
    version: Number(version.version || 0) + 1,
    title: version.title ? `${version.title} (copy)` : '',
    versionStatus: 'draft',
  }
}

function sortByOrder(rows, field = 'order') {
  return [...(Array.isArray(rows) ? rows : [])].sort((left, right) => {
    const leftOrder = Number(left?.[field] ?? 0)
    const rightOrder = Number(right?.[field] ?? 0)
    if (leftOrder !== rightOrder) return leftOrder - rightOrder
    const leftCreatedAt = String(left?.createdAt || '')
    const rightCreatedAt = String(right?.createdAt || '')
    if (leftCreatedAt && rightCreatedAt && leftCreatedAt !== rightCreatedAt) return leftCreatedAt.localeCompare(rightCreatedAt)
    return String(getEntityId(left) || '').localeCompare(String(getEntityId(right) || ''))
  })
}

function moveItem(rows, id, direction) {
  const ordered = sortByOrder(rows)
  const index = ordered.findIndex((item) => String(getEntityId(item)) === String(id))
  if (index < 0) return []
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= ordered.length) return []
  const swapped = [...ordered]
  const temp = swapped[index]
  swapped[index] = swapped[targetIndex]
  swapped[targetIndex] = temp
  return swapped.map((item, itemIndex) => ({ id: getEntityId(item), order: itemIndex + 1 }))
}

function getSectionReorderErrorMessage(error) {
  const message = getApiMessage(error, 'Không sắp xếp lại được các phần thi')
  if (message === 'Only draft assessment versions can be structurally modified') return 'Phiên bản đã xuất bản, không thể thay đổi cấu trúc.'
  if (message === 'items must contain at least one section reorder entry') return 'Không có dữ liệu phần thi để sắp xếp lại.'
  if (message === 'items must include every section in the assessment version exactly once') return 'Danh sách phần thi gửi lên không đầy đủ hoặc đã bị lệch trạng thái. Vui lòng tải lại trang.'
  if (message === 'Duplicate section id in reorder payload') return 'Danh sách phần thi gửi lên bị trùng. Vui lòng tải lại trang và thử lại.'
  if (message === 'Duplicate order value in reorder payload') return 'Thứ tự phần thi gửi lên không hợp lệ. Vui lòng tải lại trang và thử lại.'
  if (message === 'Section does not belong to the specified assessment version') return 'Phần thi không còn thuộc phiên bản hiện tại. Vui lòng tải lại trang.'
  return message
}

function getNextQuestionOrder(rows) {
  return (Array.isArray(rows) ? rows : []).reduce((maxOrder, item) => Math.max(maxOrder, Number(item?.order || 0)), 0) + 1
}

function VersionSummaryCard({ version, isSelected, onSelect }) {
  const stats = computeVersionStats(version)
  return (
    <CCard className={`border ${isSelected ? 'border-primary' : ''}`}>
      <CCardBody>
        <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-2'>
          <div>
            <div className='fw-semibold'>{version.title || version.code}</div>
            <div className='small text-body-secondary'>{`${version.code} · v${version.version}`}</div>
          </div>
          <CBadge color={getStatusBadgeColor(version.versionStatus)}>{getVersionStatusLabel(version.versionStatus)}</CBadge>
        </div>
        <div className='small text-body-secondary mb-2'>{`${stats.totalSections} phần · ${stats.totalQuestions} câu · ${stats.totalPoints} điểm`}</div>
        <div className='small text-body-secondary mb-3'>{`${formatGradeRange(version)} · ${formatCandidateRange(version)}`}</div>
        <CButton size='sm' color={isSelected ? 'primary' : 'secondary'} variant={isSelected ? undefined : 'outline'} onClick={onSelect}>Chọn phiên bản</CButton>
      </CCardBody>
    </CCard>
  )
}

function SectionCard({ section, currentVersionIsDraft, savingSection = false, onEdit, onDelete, onMoveUp, onMoveDown, onSaveQuestionOrders, onAddQuestions, onEditQuestion, onRemoveQuestion, onMoveQuestionUp, onMoveQuestionDown }) {
  const sourceQuestions = useMemo(() => sortByOrder(section?.assessmentQuestions), [section])
  const [orderDrafts, setOrderDrafts] = useState({})

  useEffect(() => {
    setOrderDrafts(Object.fromEntries(sourceQuestions.map((item) => [String(getEntityId(item)), String(item?.order ?? '')])))
  }, [section])

  const questions = [...sourceQuestions].sort((left, right) => {
    const leftOrder = Number(orderDrafts[String(getEntityId(left))] ?? left?.order ?? 0)
    const rightOrder = Number(orderDrafts[String(getEntityId(right))] ?? right?.order ?? 0)
    if (leftOrder !== rightOrder) return leftOrder - rightOrder
    const leftCreatedAt = String(left?.createdAt || '')
    const rightCreatedAt = String(right?.createdAt || '')
    if (leftCreatedAt && rightCreatedAt && leftCreatedAt !== rightCreatedAt) return leftCreatedAt.localeCompare(rightCreatedAt)
    return String(getEntityId(left) || '').localeCompare(String(getEntityId(right) || ''))
  })
  const stats = computeSectionStats({ assessmentQuestions: questions })
  const hasOrderChanges = questions.some((item) => String(orderDrafts[String(getEntityId(item))] ?? '') !== String(item?.order ?? ''))

  function buildOrderItems() {
    return questions.map((item) => ({
      id: getEntityId(item),
      order: Number(orderDrafts[String(getEntityId(item))] ?? item?.order ?? 0),
    }))
  }

  return (
    <CCard className='ai-card'>
      <CCardHeader className='d-flex justify-content-between align-items-start gap-3 flex-wrap'>
        <div>
          <div className='fw-semibold'>{`${section.code || ''} · ${section.title || ''}`}</div>
          <div className='small text-body-secondary'>{`${stats.totalQuestions} câu hỏi · ${stats.totalPoints} điểm`}</div>
          {section.skill?.title ? <div className='small text-body-secondary'>{`Kỹ năng: ${section.skill.title}`}</div> : null}
        </div>
        <div className='d-flex gap-2 flex-wrap'>
          <CButton size='sm' color='secondary' variant='outline' onClick={onMoveUp} disabled={!currentVersionIsDraft || savingSection}>Lên</CButton>
          <CButton size='sm' color='secondary' variant='outline' onClick={onMoveDown} disabled={!currentVersionIsDraft || savingSection}>Xuống</CButton>
          <CButton size='sm' color='primary' variant='outline' onClick={() => onSaveQuestionOrders(buildOrderItems())} disabled={!currentVersionIsDraft || !hasOrderChanges || savingSection}>Lưu thứ tự</CButton>
          <CButton size='sm' color='info' variant='outline' onClick={onAddQuestions} disabled={!currentVersionIsDraft || savingSection}>+ Câu hỏi</CButton>
          <CButton size='sm' color='secondary' variant='outline' onClick={onEdit} disabled={!currentVersionIsDraft || savingSection}>Sửa phần</CButton>
          <CButton size='sm' color='danger' variant='outline' onClick={onDelete} disabled={!currentVersionIsDraft || savingSection}>Xóa phần</CButton>
        </div>
      </CCardHeader>
      <CCardBody>
        {section.description ? <div className='small mb-2'>{truncateText(section.description, 180)}</div> : null}
        {section.instruction ? <div className='small text-body-secondary mb-3'>{truncateText(section.instruction, 180)}</div> : null}
        {questions.length === 0 ? <div className='text-body-secondary'>Chưa có câu hỏi trong phần này.</div> : (
          <div className='d-grid gap-3'>
            {questions.map((item, index) => (
              <div key={getEntityId(item) || `${section.code}-${index}`} className='border rounded-3 p-3'>
                <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-2'>
                  <div>
                    <div className='d-flex align-items-center gap-2 flex-wrap mb-1'>
                      <CFormInput
                        type='number'
                        min={1}
                        value={orderDrafts[String(getEntityId(item))] ?? item?.order ?? ''}
                        onChange={(event) => setOrderDrafts((prev) => ({ ...prev, [String(getEntityId(item))]: event.target.value }))}
                        disabled={!currentVersionIsDraft}
                        style={{ width: 92 }}
                      />
                      <div className='fw-semibold'>{item.question?.code || ''}</div>
                    </div>
                    <div className='small text-body-secondary'>{getQuestionTypeLabel(item.question?.type)}</div>
                  </div>
                  <div className='small text-body-secondary'>{`${item.points || 1} điểm · ${item.required ? 'Bắt buộc' : 'Tùy chọn'}`}</div>
                </div>
                <div className='mb-2'>{truncateText(item.question?.questionText, 180)}</div>
                <div className='small text-body-secondary mb-3'>{getRuntimeConfigSummary(item)}</div>
                <div className='d-flex gap-2 flex-wrap'>
                  <CButton size='sm' color='secondary' variant='outline' onClick={onMoveQuestionUp(item)} disabled={!currentVersionIsDraft || index === 0}>Lên</CButton>
                  <CButton size='sm' color='secondary' variant='outline' onClick={onMoveQuestionDown(item)} disabled={!currentVersionIsDraft || index === questions.length - 1}>Xuống</CButton>
                  <CButton size='sm' color='secondary' variant='outline' onClick={onEditQuestion(item)} disabled={!currentVersionIsDraft}>Cấu hình</CButton>
                  <CButton size='sm' color='danger' variant='outline' onClick={onRemoveQuestion(item)} disabled={!currentVersionIsDraft}>Gỡ khỏi phần</CButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </CCardBody>
    </CCard>
  )
}

export default function AssessmentDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [bootstrap, setBootstrap] = useState(null)
  const [assessment, setAssessment] = useState(null)
  const [versionDetail, setVersionDetail] = useState(null)
  const [validation, setValidation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [versionLoading, setVersionLoading] = useState(false)
  const [validationLoading, setValidationLoading] = useState(false)
  const [savingAssessment, setSavingAssessment] = useState(false)
  const [savingVersion, setSavingVersion] = useState(false)
  const [savingSection, setSavingSection] = useState(false)
  const [savingQuestion, setSavingQuestion] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [validationError, setValidationError] = useState('')
  const [showAssessmentEditor, setShowAssessmentEditor] = useState(false)
  const [showVersionEditor, setShowVersionEditor] = useState(false)
  const [versionEditorMode, setVersionEditorMode] = useState('create')
  const [versionEditorValue, setVersionEditorValue] = useState(null)
  const [showSectionEditor, setShowSectionEditor] = useState(false)
  const [editingSection, setEditingSection] = useState(null)
  const [showQuestionPicker, setShowQuestionPicker] = useState(false)
  const [pickerSection, setPickerSection] = useState(null)
  const [showQuestionEditor, setShowQuestionEditor] = useState(false)
  const [editingAssessmentQuestion, setEditingAssessmentQuestion] = useState(null)

  const requestedTab = String(searchParams.get('tab') || '').trim()
  const selectedVersionId = String(searchParams.get('version') || '').trim()
  const subjects = bootstrap?.subjects || []
  const skills = bootstrap?.skills || []
  const versions = useMemo(() => sortByOrder([...(assessment?.versions || [])], 'version').reverse(), [assessment])
  const currentVersionSummary = useMemo(() => versions.find((item) => String(getEntityId(item)) === String(selectedVersionId)) || versions[0] || null, [selectedVersionId, versions])
  const currentVersionIsDraft = String(versionDetail?.versionStatus || currentVersionSummary?.versionStatus || '').trim() === 'draft'
  const speakingRequired = (versionDetail || currentVersionSummary)?.requiresSpeaking !== false
  const availableTabs = useMemo(() => TABS.filter((item) => item.key !== 'speaking-config' || speakingRequired), [speakingRequired])
  const activeTab = availableTabs.some((item) => item.key === requestedTab) ? requestedTab : 'overview'

  useEffect(() => {
    if (activeTab !== requestedTab) {
      const next = new URLSearchParams(searchParams)
      next.set('tab', activeTab)
      setSearchParams(next, { replace: true })
    }
  }, [activeTab, requestedTab, searchParams, setSearchParams])

  useEffect(() => {
    loadBootstrapAndAssessment()
  }, [id])

  useEffect(() => {
    const targetVersionId = currentVersionSummary ? getEntityId(currentVersionSummary) : ''
    if (!targetVersionId) {
      setVersionDetail(null)
      setValidation(null)
      return
    }
    if (!selectedVersionId || String(selectedVersionId) !== String(targetVersionId)) {
      const next = new URLSearchParams(searchParams)
      next.set('version', String(targetVersionId))
      next.set('tab', activeTab)
      setSearchParams(next, { replace: true })
      return
    }
    loadVersionDetail(targetVersionId)
  }, [currentVersionSummary, selectedVersionId])

  async function loadBootstrapAndAssessment() {
    setLoading(true)
    setError('')
    try {
      const [bootstrapPayload, assessmentPayload] = await Promise.all([
        getLearningManagementBootstrap(),
        getAssessment(id),
      ])
      setBootstrap(bootstrapPayload)
      setAssessment(assessmentPayload)
      setSuccess('')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không tải được chi tiết ngân hàng đề'))
    } finally {
      setLoading(false)
    }
  }

  async function loadAssessmentOnly(options = {}) {
    const payload = await getAssessment(id)
    setAssessment(payload)
    const nextVersionId = options.preferredVersionId || selectedVersionId || getEntityId(payload?.versions?.[0])
    if (nextVersionId) {
      const next = new URLSearchParams(searchParams)
      next.set('version', String(nextVersionId))
      next.set('tab', activeTab)
      setSearchParams(next, { replace: true })
    }
    return payload
  }

  async function loadVersionDetail(versionId) {
    setVersionLoading(true)
    setValidation(null)
    setValidationError('')
    try {
      const payload = await getAssessmentVersion(versionId)
      setVersionDetail(payload)
    } catch (requestError) {
      setVersionDetail(null)
      setError(getApiMessage(requestError, 'Không tải được chi tiết phiên bản'))
    } finally {
      setVersionLoading(false)
    }
  }

  async function refreshVersion(versionId = selectedVersionId) {
    await loadAssessmentOnly({ preferredVersionId: versionId })
    if (versionId) await loadVersionDetail(versionId)
  }

  async function runValidation(versionId = selectedVersionId) {
    if (!versionId) return
    setValidationLoading(true)
    setValidationError('')
    try {
      const payload = await validateAssessmentVersion(versionId)
      setValidation(payload)
    } catch (requestError) {
      setValidation(null)
      setValidationError(getApiMessage(requestError, 'Không kiểm tra được phiên bản đề'))
    } finally {
      setValidationLoading(false)
    }
  }

  async function handleAssessmentSubmit(payload) {
    setSavingAssessment(true)
    setError('')
    setSuccess('')
    try {
      await updateAssessment(id, payload)
      await loadAssessmentOnly()
      setShowAssessmentEditor(false)
      setSuccess('Đã cập nhật thông tin đề')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không cập nhật được đề'))
      throw requestError
    } finally {
      setSavingAssessment(false)
    }
  }

  async function handleVersionSubmit(payload) {
    setSavingVersion(true)
    setError('')
    setSuccess('')
    try {
      let savedVersion = null
      if (versionEditorMode === 'edit' && versionEditorValue) {
        savedVersion = await updateAssessmentVersion(getEntityId(versionEditorValue), payload)
      } else if (versionEditorMode === 'clone' && versionDetail) {
        savedVersion = await cloneAssessmentVersion(getEntityId(versionDetail), payload)
      } else {
        savedVersion = await createAssessmentVersion({ ...payload, assessment: getEntityId(assessment) })
      }
      const savedVersionId = getEntityId(savedVersion)
      await refreshVersion(savedVersionId)
      setShowVersionEditor(false)
      setVersionEditorValue(null)
      setSuccess(versionEditorMode === 'edit' ? 'Đã cập nhật phiên bản' : versionEditorMode === 'clone' ? 'Đã nhân bản phiên bản' : 'Đã tạo phiên bản mới')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không lưu được phiên bản'))
      throw requestError
    } finally {
      setSavingVersion(false)
    }
  }

  async function handlePublishVersion() {
    if (!versionDetail) return
    setSavingVersion(true)
    setError('')
    setSuccess('')
    try {
      await publishAssessmentVersion(getEntityId(versionDetail))
      await refreshVersion(getEntityId(versionDetail))
      setSuccess('Đã publish phiên bản')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không publish được phiên bản'))
    } finally {
      setSavingVersion(false)
    }
  }

  async function handleRetireVersion() {
    if (!versionDetail) return
    if (!window.confirm(`Ngừng sử dụng phiên bản ${versionDetail.code}?`)) return
    setSavingVersion(true)
    setError('')
    setSuccess('')
    try {
      await retireAssessmentVersion(getEntityId(versionDetail))
      await refreshVersion(getEntityId(versionDetail))
      setSuccess('Đã ngừng sử dụng phiên bản')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể retire phiên bản'))
    } finally {
      setSavingVersion(false)
    }
  }

  async function handleDeleteVersion() {
    if (!currentVersionSummary) return
    if (!window.confirm(`Xóa phiên bản ${currentVersionSummary.code}?`)) return
    setSavingVersion(true)
    setError('')
    setSuccess('')
    try {
      await deleteAssessmentVersion(getEntityId(currentVersionSummary))
      const payload = await loadAssessmentOnly()
      const nextVersionId = getEntityId(payload?.versions?.[0])
      if (nextVersionId) await loadVersionDetail(nextVersionId)
      else setVersionDetail(null)
      setSuccess('Đã xóa phiên bản draft')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không xóa được phiên bản'))
    } finally {
      setSavingVersion(false)
    }
  }

  async function handleSectionSubmit(payload) {
    setSavingSection(true)
    setError('')
    setSuccess('')
    try {
      if (editingSection) {
        await updateAssessmentSection(getEntityId(editingSection), payload)
      } else {
        const orderedSections = sortByOrder(versionDetail?.sections)
        await createAssessmentSection(getEntityId(versionDetail), { ...payload, order: payload.order || orderedSections.length + 1 })
      }
      await refreshVersion(getEntityId(versionDetail))
      setShowSectionEditor(false)
      setEditingSection(null)
      setSuccess(editingSection ? 'Đã cập nhật phần thi' : 'Đã tạo phần thi')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không lưu được phần thi'))
      throw requestError
    } finally {
      setSavingSection(false)
    }
  }

  async function handleDeleteSection(section) {
    if (!window.confirm(`Xóa phần ${section.code || section.title}?`)) return
    setSavingSection(true)
    setError('')
    setSuccess('')
    try {
      await deleteAssessmentSection(getEntityId(section))
      await refreshVersion(getEntityId(versionDetail))
      setSuccess('Đã xóa phần thi')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không xóa được phần thi'))
    } finally {
      setSavingSection(false)
    }
  }

  async function handleMoveSection(section, direction) {
    if (savingSection) return
    const items = moveItem(versionDetail?.sections, getEntityId(section), direction)
    if (items.length === 0) return
    setSavingSection(true)
    setError('')
    try {
      await reorderAssessmentSections(getEntityId(versionDetail), items)
      await refreshVersion(getEntityId(versionDetail))
    } catch (requestError) {
      setError(getSectionReorderErrorMessage(requestError))
    } finally {
      setSavingSection(false)
    }
  }

  async function handleAddQuestions({ questionIds, defaults }) {
    if (!pickerSection) return
    setSavingQuestion(true)
    setError('')
    setSuccess('')
    try {
      const sectionId = getEntityId(pickerSection)
      const existingQuestions = sortByOrder(pickerSection.assessmentQuestions)
      const baseOrder = getNextQuestionOrder(existingQuestions)
      for (let index = 0; index < questionIds.length; index += 1) {
        await addAssessmentQuestion(sectionId, {
          section: sectionId,
          question: questionIds[index],
          order: baseOrder + index,
          points: Number(defaults.points || 1),
          required: defaults.required,
          audioPlayLimit: defaults.audioPlayLimit === '' ? null : Number(defaults.audioPlayLimit),
          allowSeek: defaults.allowSeek,
          minWords: defaults.minWords === '' ? null : Number(defaults.minWords),
          maxWords: defaults.maxWords === '' ? null : Number(defaults.maxWords),
        })
      }
      await refreshVersion(getEntityId(versionDetail))
      setShowQuestionPicker(false)
      setPickerSection(null)
      setSuccess(`Đã thêm ${questionIds.length} câu hỏi vào phần thi`)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thêm được câu hỏi vào phần thi'))
      throw requestError
    } finally {
      setSavingQuestion(false)
    }
  }

  async function handleQuestionSubmit(payload) {
    if (!editingAssessmentQuestion) return
    setSavingQuestion(true)
    setError('')
    setSuccess('')
    try {
      await updateAssessmentQuestion(getEntityId(editingAssessmentQuestion), payload)
      await refreshVersion(getEntityId(versionDetail))
      setShowQuestionEditor(false)
      setEditingAssessmentQuestion(null)
      setSuccess('Đã cập nhật cấu hình câu hỏi trong đề')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không lưu được cấu hình câu hỏi'))
      throw requestError
    } finally {
      setSavingQuestion(false)
    }
  }

  async function handleRemoveQuestion(item) {
    if (!window.confirm(`Gỡ câu hỏi ${item.question?.code || ''} khỏi phần thi?`)) return
    setSavingQuestion(true)
    setError('')
    setSuccess('')
    try {
      await removeAssessmentQuestion(getEntityId(item))
      await refreshVersion(getEntityId(versionDetail))
      setSuccess('Đã gỡ câu hỏi khỏi phần thi')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không gỡ được câu hỏi khỏi phần thi'))
    } finally {
      setSavingQuestion(false)
    }
  }

  async function handleMoveQuestion(section, item, direction) {
    const items = moveItem(section?.assessmentQuestions, getEntityId(item), direction)
    if (items.length === 0) return
    setSavingQuestion(true)
    setError('')
    try {
      await reorderAssessmentQuestions(getEntityId(section), items)
      await refreshVersion(getEntityId(versionDetail))
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không sắp xếp lại được câu hỏi'))
    } finally {
      setSavingQuestion(false)
    }
  }

  async function handleSaveQuestionOrders(section, items) {
    if (!Array.isArray(items) || items.length === 0) return
    setSavingQuestion(true)
    setError('')
    setSuccess('')
    try {
      await reorderAssessmentQuestions(getEntityId(section), items)
      await refreshVersion(getEntityId(versionDetail))
      setSuccess('Đã lưu thứ tự câu hỏi')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không lưu được thứ tự câu hỏi'))
    } finally {
      setSavingQuestion(false)
    }
  }

  if (loading) {
    return <div className='py-4 d-flex align-items-center gap-2'><CSpinner size='sm' /><span>Đang tải ngân hàng đề...</span></div>
  }

  if (!assessment) {
    return <CAlert color='warning'>Không tìm thấy assessment.</CAlert>
  }

  return (
    <>
      <CCard className='mb-4 ai-card'>
        <CCardHeader className='d-flex justify-content-between align-items-start gap-3 flex-wrap'>
          <div>
            <div className='d-flex align-items-center gap-2 flex-wrap mb-2'>
              <CButton color='secondary' variant='outline' size='sm' onClick={() => navigate('/assessments')}>Về danh sách</CButton>
              <CBadge color={getStatusBadgeColor(assessment.status)}>{getAssessmentStatusLabel(assessment.status)}</CBadge>
              <CBadge color='secondary'>{getAssessmentTypeLabel(assessment.assessmentType)}</CBadge>
            </div>
            <div className='fs-4 fw-semibold'>{assessment.name}</div>
            <div className='text-body-secondary'>{assessment.code}</div>
            {assessment.description ? <div className='text-body-secondary mt-2'>{assessment.description}</div> : null}
            <div className='small text-body-secondary mt-2'>{`${assessment.subject?.title || 'Chưa gắn môn học'} · Cập nhật ${formatDateTime(assessment.updatedAt)}`}</div>
          </div>
          <div className='d-flex gap-2 flex-wrap'>
            <CButton color='secondary' variant='outline' onClick={() => setShowAssessmentEditor(true)}>Sửa đề</CButton>
            <CButton color='primary' onClick={() => { setVersionEditorMode('create'); setVersionEditorValue(null); setShowVersionEditor(true) }}>+ Tạo phiên bản</CButton>
          </div>
        </CCardHeader>
      </CCard>

      {error ? <CAlert color='danger'>{error}</CAlert> : null}
      {success ? <CAlert color='success'>{success}</CAlert> : null}

      <CCard className='mb-4 ai-card'>
        <CCardBody>
          <CRow className='g-3 align-items-end'>
            <CCol lg={4} md={6}>
              <CFormLabel>Phiên bản đang xem</CFormLabel>
              <CFormSelect value={getEntityId(currentVersionSummary)} onChange={(event) => {
                const next = new URLSearchParams(searchParams)
                next.set('version', event.target.value)
                next.set('tab', activeTab)
                setSearchParams(next)
              }}>
                {versions.length === 0 ? <option value=''>Chưa có phiên bản</option> : versions.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{`${item.code} · v${item.version} · ${getVersionStatusLabel(item.versionStatus)}`}</option>)}
              </CFormSelect>
            </CCol>
            {currentVersionSummary ? (
              <CCol lg={8} md={6}>
                <div className='d-flex gap-2 flex-wrap justify-content-md-end'>
                  <CButton color='secondary' variant='outline' onClick={() => { setVersionEditorMode('edit'); setVersionEditorValue(versionDetail || currentVersionSummary); setShowVersionEditor(true) }} disabled={!currentVersionSummary}>Sửa phiên bản</CButton>
                  <CButton color='secondary' variant='outline' onClick={() => { setVersionEditorMode('clone'); setVersionEditorValue(buildCloneDraft(versionDetail || currentVersionSummary)); setShowVersionEditor(true) }} disabled={!currentVersionSummary}>Nhân bản</CButton>
                  <CButton color='info' variant='outline' onClick={() => navigate(`/assessment-runner/start/${getEntityId(currentVersionSummary)}`)} disabled={!currentVersionSummary || (currentVersionSummary?.versionStatus || '') !== 'published'}>Làm thử</CButton>
                  <CButton color='success' variant='outline' onClick={handlePublishVersion} disabled={!currentVersionIsDraft || savingVersion || !versionDetail}>Publish</CButton>
                  <CButton color='warning' variant='outline' onClick={handleRetireVersion} disabled={savingVersion || !versionDetail}>Retire</CButton>
                  <CButton color='danger' variant='outline' onClick={handleDeleteVersion} disabled={!currentVersionIsDraft || savingVersion || !currentVersionSummary}>Xóa version</CButton>
                </div>
              </CCol>
            ) : null}
          </CRow>
        </CCardBody>
      </CCard>

      <CNav variant='tabs' className='mb-4 flex-nowrap overflow-auto'>
        {availableTabs.map((tab) => (
          <CNavItem key={tab.key}>
            <CNavLink active={tab.key === activeTab} href={`/assessments/${id}?tab=${encodeURIComponent(tab.key)}${currentVersionSummary ? `&version=${encodeURIComponent(getEntityId(currentVersionSummary))}` : ''}`} onClick={(event) => {
              event.preventDefault()
              const next = new URLSearchParams(searchParams)
              next.set('tab', tab.key)
              if (currentVersionSummary) next.set('version', String(getEntityId(currentVersionSummary)))
              setSearchParams(next)
            }}>{tab.label}</CNavLink>
          </CNavItem>
        ))}
      </CNav>

      {activeTab === 'overview' ? (
        <div className='d-grid gap-4'>
          <CRow className='g-4'>
            <CCol lg={8}>
              <CCard className='ai-card h-100'>
                <CCardHeader><strong>Thông tin assessment</strong></CCardHeader>
                <CCardBody>
                  <div className='d-grid gap-2'>
                    <div><strong>Mã đề:</strong> {assessment.code}</div>
                    <div><strong>Tên đề:</strong> {assessment.name}</div>
                    <div><strong>Loại đề:</strong> {getAssessmentTypeLabel(assessment.assessmentType)}</div>
                    <div><strong>Môn học:</strong> {assessment.subject?.title || '-'}</div>
                    <div><strong>Trạng thái:</strong> {getAssessmentStatusLabel(assessment.status)}</div>
                    <div><strong>Số phiên bản:</strong> {versions.length}</div>
                  </div>
                </CCardBody>
              </CCard>
            </CCol>
            <CCol lg={4}>
              <CCard className='ai-card h-100'>
                <CCardHeader><strong>Phiên bản đang chọn</strong></CCardHeader>
                <CCardBody>
                  {!currentVersionSummary ? <div className='text-body-secondary'>Chưa có phiên bản nào.</div> : versionLoading ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' /><span>Đang tải phiên bản...</span></div> : (
                    <>
                      <div className='fw-semibold'>{currentVersionSummary.title || currentVersionSummary.code}</div>
                      <div className='small text-body-secondary mb-2'>{`${currentVersionSummary.code} · v${currentVersionSummary.version}`}</div>
                      <div className='small text-body-secondary'>{formatGradeRange(versionDetail || currentVersionSummary)}</div>
                      <div className='small text-body-secondary'>{formatCandidateRange(versionDetail || currentVersionSummary)}</div>
                      <div className='small text-body-secondary'>{`${(versionDetail || currentVersionSummary)?.durationMinutes || 0} phút`}</div>
                    </>
                  )}
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
          <AssessmentValidationSummary loading={validationLoading} data={validation} error={validationError} onValidate={() => runValidation(getEntityId(currentVersionSummary))} />
        </div>
      ) : null}

      {activeTab === 'versions' ? (
        <CRow className='g-4'>
          {versions.length === 0 ? <CCol xs={12}><CAlert color='info'>Assessment này chưa có phiên bản nào.</CAlert></CCol> : versions.map((item) => (
            <CCol lg={4} md={6} key={getEntityId(item)}>
              <VersionSummaryCard version={item} isSelected={String(getEntityId(item)) === String(getEntityId(currentVersionSummary))} onSelect={() => {
                const next = new URLSearchParams(searchParams)
                next.set('tab', 'versions')
                next.set('version', String(getEntityId(item)))
                setSearchParams(next)
              }} />
            </CCol>
          ))}
        </CRow>
      ) : null}

      {activeTab === 'structure' ? (
        <div className='d-grid gap-4'>
          <CCard className='ai-card'>
            <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
              <div>
                <strong>Cấu trúc đề</strong>
                {versionDetail ? <span className='small text-body-secondary ms-2'>{`${versionDetail.code} · ${getVersionStatusLabel(versionDetail.versionStatus)}`}</span> : null}
              </div>
              <CButton color='primary' onClick={() => { setEditingSection(null); setShowSectionEditor(true) }} disabled={!versionDetail || !currentVersionIsDraft}>+ Tạo phần thi</CButton>
            </CCardHeader>
            <CCardBody>
              {versionLoading ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' /><span>Đang tải cấu trúc đề...</span></div> : !versionDetail ? <div className='text-body-secondary'>Chưa có phiên bản để chỉnh sửa.</div> : sortByOrder(versionDetail.sections).length === 0 ? <div className='text-body-secondary'>Phiên bản này chưa có phần thi nào.</div> : (
                <div className='d-grid gap-4'>
                  {sortByOrder(versionDetail.sections).map((section) => (
                    <SectionCard
                      key={getEntityId(section)}
                      section={section}
                      currentVersionIsDraft={currentVersionIsDraft}
                      savingSection={savingSection}
                      onEdit={() => { setEditingSection(section); setShowSectionEditor(true) }}
                      onDelete={() => handleDeleteSection(section)}
                      onMoveUp={() => handleMoveSection(section, 'up')}
                      onMoveDown={() => handleMoveSection(section, 'down')}
                      onSaveQuestionOrders={(items) => handleSaveQuestionOrders(section, items)}
                      onAddQuestions={() => { setPickerSection(section); setShowQuestionPicker(true) }}
                      onEditQuestion={(item) => () => { setEditingAssessmentQuestion({ ...item, section }); setShowQuestionEditor(true) }}
                      onRemoveQuestion={(item) => () => handleRemoveQuestion(item)}
                      onMoveQuestionUp={(item) => () => handleMoveQuestion(section, item, 'up')}
                      onMoveQuestionDown={(item) => () => handleMoveQuestion(section, item, 'down')}
                    />
                  ))}
                </div>
              )}
            </CCardBody>
          </CCard>
        </div>
      ) : null}

      {activeTab === 'speaking-config' ? (
        <AssessmentSpeakingCriteriaTab versionId={getEntityId(versionDetail || currentVersionSummary)} versionStatus={versionDetail?.versionStatus || currentVersionSummary?.versionStatus || ''} />
      ) : null}

      {activeTab === 'placement-rules' ? (
        <AssessmentPlacementRulesTab versionId={getEntityId(versionDetail || currentVersionSummary)} versionStatus={versionDetail?.versionStatus || currentVersionSummary?.versionStatus || ''} />
      ) : null}

      {activeTab === 'preview' ? (
        versionLoading ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' /><span>Đang tải bản xem trước...</span></div> : <AssessmentPreview assessment={assessment} version={versionDetail} showAdminAnswers />
      ) : null}

      <AssessmentEditorModal visible={showAssessmentEditor} saving={savingAssessment} assessment={assessment} subjects={subjects} onClose={() => { if (!savingAssessment) setShowAssessmentEditor(false) }} onSubmit={handleAssessmentSubmit} />
      <AssessmentVersionEditorModal visible={showVersionEditor} saving={savingVersion} mode={versionEditorMode} assessment={assessment} version={versionEditorValue} onClose={() => { if (!savingVersion) { setShowVersionEditor(false); setVersionEditorValue(null) } }} onSubmit={handleVersionSubmit} />
      <AssessmentSectionEditorModal visible={showSectionEditor} saving={savingSection} section={editingSection} versionId={getEntityId(versionDetail || currentVersionSummary)} skills={skills} onClose={() => { if (!savingSection) { setShowSectionEditor(false); setEditingSection(null) } }} onSubmit={handleSectionSubmit} />
      <AssessmentQuestionPickerModal visible={showQuestionPicker} section={pickerSection} bootstrap={bootstrap} saving={savingQuestion} onClose={() => { if (!savingQuestion) { setShowQuestionPicker(false); setPickerSection(null) } }} onAdd={handleAddQuestions} />
      <AssessmentQuestionEditorModal visible={showQuestionEditor} saving={savingQuestion} item={editingAssessmentQuestion} onClose={() => { if (!savingQuestion) { setShowQuestionEditor(false); setEditingAssessmentQuestion(null) } }} onSubmit={handleQuestionSubmit} />
    </>
  )
}
