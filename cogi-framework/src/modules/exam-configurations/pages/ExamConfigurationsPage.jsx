import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { CButton, CContainer } from '@coreui/react'
import ExamComponentsTab from '../components/ExamComponentsTab'
import OutcomeStandardsTab from '../components/OutcomeStandardsTab'
import ExamProgramsTab from '../components/ExamProgramsTab'
import ExamSubjectsTab from '../components/ExamSubjectsTab'
import ExamConfigurationTabs from '../components/ExamConfigurationTabs'
import ExamConfigurationsOverviewPage from '../components/ExamConfigurationsOverviewPage'
import ExamConfigurationPlaceholderPage from '../components/ExamConfigurationPlaceholderPage'
import {
  buildExamConfigurationPath,
  getExamConfigurationPlaceholderCopy,
  resolveExamConfigurationTab,
} from '../utils/examConfigurationUi'
import { useFeature } from '../../../contexts/FeatureContext'

const OVERVIEW_STATS = [
  { key: 'componentsTotal', title: 'Tổng số kỹ năng thi', value: 'Chưa có dữ liệu', subtitle: 'Backend chưa expose API list' },
  { key: 'componentsActive', title: 'Kỹ năng đang hoạt động', value: 'Chưa có dữ liệu', subtitle: 'Backend chưa expose API list' },
  { key: 'subjectsTotal', title: 'Tổng số môn thi', value: 'Chưa có dữ liệu', subtitle: 'Backend chưa expose API list' },
  { key: 'programsTotal', title: 'Tổng số chương trình thi', value: 'Chưa có dữ liệu', subtitle: 'Backend chưa expose API list' },
  { key: 'outcomesTotal', title: 'Tổng số chuẩn đầu ra', value: 'Chưa có dữ liệu', subtitle: 'Backend chưa expose API list' },
]

export default function ExamConfigurationsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { tenantCode } = useParams()
  const feature = useFeature()
  const activeTab = useMemo(() => resolveExamConfigurationTab(location.pathname), [location.pathname])
  const placeholderCopy = getExamConfigurationPlaceholderCopy(activeTab)
  const canManage = feature?.hasFeature?.('exam-round.manage') || false
  const [statsError, setStatsError] = useState('')

  useEffect(() => {
    setStatsError('Các API danh mục nền chưa khả dụng trên backend hiện tại.')
  }, [])

  function openTab(tab) {
    navigate(buildExamConfigurationPath(tab, tenantCode))
  }

  function openCreateComponent() {
    navigate(`${buildExamConfigurationPath('components', tenantCode)}?action=create`)
  }

  return (
    <CContainer fluid className='py-4'>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3'>
        <div>
          <div className='fs-4 fw-semibold'>Cấu hình thi chuẩn đầu ra</div>
          <div className='text-body-secondary'>Quản lý các danh mục nền gồm kỹ năng thi, môn thi, chương trình thi và chuẩn đầu ra. Các cấu hình này được sử dụng để tạo cấu trúc cho các đợt thi.</div>
        </div>
        <CButton color='secondary' variant='outline' onClick={() => navigate(buildExamConfigurationPath('overview', tenantCode))}>Về Tổng quan</CButton>
      </div>

      <ExamConfigurationTabs activeTab={activeTab} onChange={openTab} />

      {activeTab === 'overview'
        ? <ExamConfigurationsOverviewPage onOpenTab={openTab} onCreateComponent={openCreateComponent} canManage={canManage} stats={OVERVIEW_STATS} statsError={statsError} statsLoading={false} onRetryStats={() => setStatsError('Các API danh mục nền chưa khả dụng trên backend hiện tại.')} />
        : activeTab === 'components'
          ? <ExamComponentsTab />
          : activeTab === 'subjects'
            ? <ExamSubjectsTab />
            : activeTab === 'programs'
              ? <ExamProgramsTab />
              : activeTab === 'outcomes'
                ? <OutcomeStandardsTab />
          : <ExamConfigurationPlaceholderPage title={placeholderCopy.title} description={placeholderCopy.description} notice={placeholderCopy.notice} />}
    </CContainer>
  )
}