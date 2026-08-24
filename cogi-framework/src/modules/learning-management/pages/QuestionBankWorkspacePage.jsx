import { useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CNav,
  CNavItem,
  CNavLink,
  CRow,
  CSpinner,
} from '@coreui/react'
import { useFeature } from '../../../contexts/FeatureContext'
import QuestionBankQuestionsTab from '../components/QuestionBankQuestionsTab'
import QuestionBankStimuliTab from '../components/QuestionBankStimuliTab'
import ReferenceDataTab from '../components/ReferenceDataTab'
import {
  createFormula,
  createGrade,
  createKnowledgeNode,
  createSkill,
  createSubject,
  deleteFormula,
  deleteGrade,
  deleteKnowledgeNode,
  deleteSkill,
  deleteSubject,
  getFormulas,
  getGrades,
  getKnowledgeNodes,
  getLearningManagementBootstrap,
  getSkills,
  getSubjects,
  updateFormula,
  updateGrade,
  updateKnowledgeNode,
  updateSkill,
  updateSubject,
} from '../services/learningObjectApi'
import { TAB_DEFINITIONS, canAccessAnyFeature, getApiMessage, getStatusBadgeColor } from '../utils/questionBankUi'

function buildTabPath(key) {
  return `/learning/questions?tab=${encodeURIComponent(key)}`
}

function FormulaCell({ row }) {
  return (
    <div>
      <div className='fw-semibold'>{row?.title || '-'}</div>
      <div className='small text-body-secondary'>{row?.plainText || row?.latex || '-'}</div>
    </div>
  )
}

export function LearningManagementTabRedirect({ targetTab }) {
  return <Navigate to={buildTabPath(targetTab)} replace />
}

export default function QuestionBankWorkspacePage() {
  const feature = useFeature()
  const [searchParams, setSearchParams] = useSearchParams()
  const [bootstrapping, setBootstrapping] = useState(true)
  const [bootstrap, setBootstrap] = useState(null)
  const [error, setError] = useState('')
  const [workspaceActions, setWorkspaceActions] = useState(null)

  const availableTabs = useMemo(() => TAB_DEFINITIONS.filter((tab) => canAccessAnyFeature(feature, tab.featureKeys)), [feature])
  const defaultTab = availableTabs[0]?.key || 'questions'
  const requestedTab = String(searchParams.get('tab') || '').trim()
  const activeTab = availableTabs.some((tab) => tab.key === requestedTab) ? requestedTab : defaultTab

  useEffect(() => {
    if (!requestedTab || requestedTab !== activeTab) {
      setSearchParams({ tab: activeTab }, { replace: true })
    }
  }, [activeTab, requestedTab, setSearchParams])

  useEffect(() => {
    loadBootstrap()
  }, [])

  async function loadBootstrap() {
    setBootstrapping(true)
    setError('')
    try {
      const payload = await getLearningManagementBootstrap()
      setBootstrap(payload)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không tải được dữ liệu Question Bank Workspace'))
    } finally {
      setBootstrapping(false)
    }
  }

  if (bootstrapping) {
    return (
      <div className='py-4 d-flex align-items-center gap-2'>
        <CSpinner size='sm' />
        <span>Đang tải Question Bank Workspace...</span>
      </div>
    )
  }

  if (availableTabs.length === 0) {
    return <CAlert color='warning'>Bạn không có quyền truy cập bất kỳ tab nào trong Question Bank Workspace.</CAlert>
  }

  return (
    <CRow className='g-0'>
      <CCol xs={12}>
        <CCard className='mb-4 ai-card'>
          <CCardHeader className='d-flex justify-content-between align-items-start gap-3 flex-wrap'>
            <div>
              <div className='fs-4 fw-semibold'>Ngân hàng câu hỏi</div>
              <div className='text-body-secondary'>Quản lý câu hỏi, ngữ liệu và dữ liệu hỗ trợ dùng chung cho học tập, kiểm tra và đánh giá.</div>
            </div>
            <div className='d-flex align-items-center gap-2 flex-wrap'>{workspaceActions}</div>
          </CCardHeader>
          <CCardBody>
            {error ? <CAlert color='danger'>{error}</CAlert> : null}
            <CNav variant='tabs' className='flex-nowrap overflow-auto mb-4'>
              {availableTabs.map((tab) => (
                <CNavItem key={tab.key}>
                  <CNavLink active={tab.key === activeTab} href={buildTabPath(tab.key)} onClick={(event) => { event.preventDefault(); setSearchParams({ tab: tab.key }) }}>
                    {tab.label}
                  </CNavLink>
                </CNavItem>
              ))}
            </CNav>

            {activeTab === 'questions' ? <QuestionBankQuestionsTab bootstrap={bootstrap} feature={feature} setWorkspaceActions={setWorkspaceActions} onRefreshBootstrap={loadBootstrap} /> : null}
            {activeTab === 'stimuli' ? <QuestionBankStimuliTab setWorkspaceActions={setWorkspaceActions} /> : null}
            {activeTab === 'subjects' ? (
              <ReferenceDataTab
                title='Môn học'
                entityLabel='subject'
                setWorkspaceActions={setWorkspaceActions}
                statusField='subjectStatus'
                load={getSubjects}
                create={createSubject}
                update={updateSubject}
                remove={deleteSubject}
                searchPlaceholder='Tìm theo code, title, mô tả...'
                columns={[
                  { key: 'code', label: 'Code', style: { width: 150 } },
                  { key: 'title', label: 'Tên', style: { minWidth: 220 } },
                  { key: 'description', label: 'Mô tả', style: { minWidth: 260 } },
                  { key: 'subjectStatus', label: 'Trạng thái', style: { width: 140 }, render: (row) => <CBadge color={getStatusBadgeColor(row?.subjectStatus)}>{row?.subjectStatus || '-'}</CBadge> },
                  { key: 'updatedAt', label: 'Cập nhật', style: { width: 180 }, render: (row) => row?.updatedAt ? new Date(row.updatedAt).toLocaleString() : '-' },
                ]}
                fields={[
                  { name: 'code', label: 'Code', colSpan: 4 },
                  { name: 'title', label: 'Title', colSpan: 8 },
                  { name: 'subjectStatus', label: 'Trạng thái', type: 'select', options: [{ value: 'active', label: 'Đang hoạt động' }, { value: 'archived', label: 'Lưu trữ' }], colSpan: 4, defaultValue: 'active' },
                  { name: 'description', label: 'Mô tả', type: 'textarea', colSpan: 12 },
                ]}
              />
            ) : null}
            {activeTab === 'grades' ? (
              <ReferenceDataTab
                title='Khối lớp'
                entityLabel='grade'
                setWorkspaceActions={setWorkspaceActions}
                statusField='gradeStatus'
                load={getGrades}
                create={createGrade}
                update={updateGrade}
                remove={deleteGrade}
                searchPlaceholder='Tìm theo code, title, mô tả...'
                columns={[
                  { key: 'code', label: 'Code', style: { width: 150 } },
                  { key: 'title', label: 'Tên', style: { minWidth: 220 } },
                  { key: 'order', label: 'Order', style: { width: 100 } },
                  { key: 'description', label: 'Mô tả', style: { minWidth: 240 } },
                  { key: 'gradeStatus', label: 'Trạng thái', style: { width: 140 }, render: (row) => <CBadge color={getStatusBadgeColor(row?.gradeStatus)}>{row?.gradeStatus || '-'}</CBadge> },
                ]}
                fields={[
                  { name: 'code', label: 'Code', colSpan: 4 },
                  { name: 'title', label: 'Title', colSpan: 5 },
                  { name: 'order', label: 'Order', type: 'number', colSpan: 3, defaultValue: 0 },
                  { name: 'gradeStatus', label: 'Trạng thái', type: 'select', options: [{ value: 'active', label: 'Đang hoạt động' }, { value: 'archived', label: 'Lưu trữ' }], colSpan: 4, defaultValue: 'active' },
                  { name: 'description', label: 'Mô tả', type: 'textarea', colSpan: 12 },
                ]}
              />
            ) : null}
            {activeTab === 'skills' ? (
              <ReferenceDataTab
                title='Kỹ năng'
                entityLabel='skill'
                setWorkspaceActions={setWorkspaceActions}
                statusField='skillStatus'
                load={getSkills}
                create={createSkill}
                update={updateSkill}
                remove={deleteSkill}
                searchPlaceholder='Tìm theo code, title...'
                columns={[
                  { key: 'code', label: 'Code', style: { width: 150 } },
                  { key: 'title', label: 'Tên', style: { minWidth: 220 } },
                  { key: 'subject', label: 'Subject', style: { width: 160 }, render: (row) => row?.subject?.title || '-' },
                  { key: 'grade', label: 'Grade', style: { width: 160 }, render: (row) => row?.grade?.title || '-' },
                  { key: 'status', label: 'Trạng thái', style: { width: 140 }, render: (row) => <CBadge color={getStatusBadgeColor(row?.status || row?.skillStatus)}>{row?.status || row?.skillStatus || '-'}</CBadge> },
                ]}
                fields={[
                  { name: 'code', label: 'Code', colSpan: 4 },
                  { name: 'title', label: 'Title', colSpan: 8 },
                  { name: 'level', label: 'Level', type: 'select', options: (bootstrap?.skillLevels || ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']).map((item) => ({ value: item, label: item })), colSpan: 4, defaultValue: 'understand' },
                  { name: 'subject', label: 'Subject', type: 'select', options: [{ value: '', label: 'Không chọn' }, ...(bootstrap?.subjects || []).map((item) => ({ value: item.id || item.documentId, label: item.title || item.code }))], colSpan: 4 },
                  { name: 'grade', label: 'Grade', type: 'select', options: [{ value: '', label: 'Không chọn' }, ...(bootstrap?.grades || []).map((item) => ({ value: item.id || item.documentId, label: item.title || item.code }))], colSpan: 4 },
                  { name: 'knowledgeNode', label: 'Knowledge Node', type: 'select', options: [{ value: '', label: 'Không chọn' }, ...(bootstrap?.knowledgeNodes || []).map((item) => ({ value: item.id || item.documentId, label: item.title || item.code }))], colSpan: 6 },
                  { name: 'parentSkill', label: 'Parent Skill', type: 'select', options: [{ value: '', label: 'Không chọn' }, ...(bootstrap?.skills || []).map((item) => ({ value: item.id || item.documentId, label: item.title || item.code }))], colSpan: 6 },
                  { name: 'skillStatus', label: 'Trạng thái', type: 'select', options: [{ value: 'active', label: 'Đang hoạt động' }, { value: 'archived', label: 'Lưu trữ' }], colSpan: 4, defaultValue: 'active' },
                  { name: 'description', label: 'Mô tả', type: 'textarea', colSpan: 12 },
                ]}
              />
            ) : null}
            {activeTab === 'knowledge-nodes' ? (
              <ReferenceDataTab
                title='Chu de kien thuc'
                entityLabel='knowledge node'
                setWorkspaceActions={setWorkspaceActions}
                statusField='knowledgeNodeStatus'
                load={getKnowledgeNodes}
                create={createKnowledgeNode}
                update={updateKnowledgeNode}
                remove={deleteKnowledgeNode}
                searchPlaceholder='Tim theo code, title...'
                columns={[
                  { key: 'code', label: 'Code', style: { width: 150 } },
                  { key: 'title', label: 'Ten', style: { minWidth: 220 } },
                  { key: 'subject', label: 'Subject', style: { width: 160 }, render: (row) => row?.subject?.title || '-' },
                  { key: 'grade', label: 'Grade', style: { width: 160 }, render: (row) => row?.grade?.title || '-' },
                  { key: 'status', label: 'Trang thai', style: { width: 140 }, render: (row) => <CBadge color={getStatusBadgeColor(row?.status || row?.knowledgeNodeStatus)}>{row?.status || row?.knowledgeNodeStatus || '-'}</CBadge> },
                ]}
                fields={[
                  { name: 'code', label: 'Code', colSpan: 4 },
                  { name: 'title', label: 'Title', colSpan: 8 },
                  { name: 'subject', label: 'Subject', type: 'select', options: [{ value: '', label: 'Khong chon' }, ...(bootstrap?.subjects || []).map((item) => ({ value: item.id || item.documentId, label: item.title || item.code }))], colSpan: 6 },
                  { name: 'grade', label: 'Grade', type: 'select', options: [{ value: '', label: 'Khong chon' }, ...(bootstrap?.grades || []).map((item) => ({ value: item.id || item.documentId, label: item.title || item.code }))], colSpan: 6 },
                  { name: 'parent', label: 'Parent Node', type: 'select', options: [{ value: '', label: 'Khong chon' }, ...(bootstrap?.knowledgeNodes || []).map((item) => ({ value: item.id || item.documentId, label: item.title || item.code }))], colSpan: 6 },
                  { name: 'order', label: 'Order', type: 'number', colSpan: 3, defaultValue: 0 },
                  { name: 'level', label: 'Level', type: 'number', colSpan: 3, defaultValue: 0 },
                  { name: 'knowledgeNodeStatus', label: 'Trang thai', type: 'select', options: [{ value: 'active', label: 'active' }, { value: 'archived', label: 'archived' }], colSpan: 4, defaultValue: 'active' },
                  { name: 'description', label: 'Mo ta', type: 'textarea', colSpan: 12 },
                ]}
              />
            ) : null}
            {activeTab === 'formulas' ? (
              <ReferenceDataTab
                title='Cong thuc'
                entityLabel='formula'
                setWorkspaceActions={setWorkspaceActions}
                statusField='formulaStatus'
                load={getFormulas}
                create={createFormula}
                update={updateFormula}
                remove={deleteFormula}
                searchPlaceholder='Tim theo code, title...'
                columns={[
                  { key: 'code', label: 'Code', style: { width: 150 } },
                  { key: 'title', label: 'Cong thuc', style: { minWidth: 280 }, render: (row) => <FormulaCell row={row} /> },
                  { key: 'subject', label: 'Subject', style: { width: 160 }, render: (row) => row?.subject?.title || '-' },
                  { key: 'grade', label: 'Grade', style: { width: 140 }, render: (row) => row?.grade?.title || '-' },
                  { key: 'formulaStatus', label: 'Trang thai', style: { width: 140 }, render: (row) => <CBadge color={getStatusBadgeColor(row?.formulaStatus)}>{row?.formulaStatus || '-'}</CBadge> },
                ]}
                fields={[
                  { name: 'code', label: 'Code', colSpan: 4 },
                  { name: 'title', label: 'Title', colSpan: 8 },
                  { name: 'latex', label: 'LaTeX', type: 'textarea', colSpan: 12 },
                  { name: 'plainText', label: 'Plain text', type: 'textarea', colSpan: 12 },
                  { name: 'subject', label: 'Subject', type: 'select', options: [{ value: '', label: 'Khong chon' }, ...(bootstrap?.subjects || []).map((item) => ({ value: item.id || item.documentId, label: item.title || item.code }))], colSpan: 6 },
                  { name: 'grade', label: 'Grade', type: 'select', options: [{ value: '', label: 'Khong chon' }, ...(bootstrap?.grades || []).map((item) => ({ value: item.id || item.documentId, label: item.title || item.code }))], colSpan: 6 },
                  { name: 'knowledgeNode', label: 'Knowledge Node', type: 'select', options: [{ value: '', label: 'Khong chon' }, ...(bootstrap?.knowledgeNodes || []).map((item) => ({ value: item.id || item.documentId, label: item.title || item.code }))], colSpan: 6 },
                  { name: 'formulaStatus', label: 'Trang thai', type: 'select', options: [{ value: 'active', label: 'active' }, { value: 'archived', label: 'archived' }], colSpan: 6, defaultValue: 'active' },
                  { name: 'description', label: 'Mo ta', type: 'textarea', colSpan: 12 },
                  { name: 'examples', label: 'Examples JSON', type: 'textarea', colSpan: 12, toPayload: (value) => { const text = String(value || '').trim(); return text ? JSON.parse(text) : null }, normalize: (row) => row?.examples ? JSON.stringify(row.examples, null, 2) : '' },
                ]}
              />
            ) : null}
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}
