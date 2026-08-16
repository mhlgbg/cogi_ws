import { CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader, CCol, CRow, CSpinner } from '@coreui/react'

const STEPS = [
  {
    title: 'Kỹ năng thi',
    description: 'Đơn vị thi nhỏ nhất, ví dụ Nghe, Nói, Đọc, Viết, Lý thuyết hoặc Thực hành.',
  },
  {
    title: 'Môn thi',
    description: 'Một môn thi gồm một hoặc nhiều kỹ năng, kèm điều kiện đạt và cấu hình lệ phí.',
  },
  {
    title: 'Chương trình thi',
    description: 'Một chương trình gồm một hoặc nhiều môn thi và là nguồn cấu hình để tạo đợt thi.',
  },
  {
    title: 'Chuẩn đầu ra',
    description: 'Quy định chương trình hoặc các điều kiện learner cần hoàn thành để được công nhận đạt chuẩn.',
  },
  {
    title: 'Đợt thi',
    description: 'Đợt thi sử dụng snapshot từ chương trình. Thay đổi danh mục không tự động thay đổi các đợt thi đã tạo.',
  },
]

function StatCard({ title, value, subtitle, isLoading = false }) {
  return (
    <CCard className='h-100'>
      <CCardBody>
        <div className='small text-body-secondary mb-2'>{title}</div>
        {isLoading ? (
          <div className='d-flex align-items-center gap-2'>
            <CSpinner size='sm' />
            <span className='small text-body-secondary'>Đang tải...</span>
          </div>
        ) : (
          <>
            <div className='fs-4 fw-semibold'>{value}</div>
            <div className='small text-body-secondary mt-1'>{subtitle}</div>
          </>
        )}
      </CCardBody>
    </CCard>
  )
}

function FlowActionButton({ label, canManage = false, onClick }) {
  return (
    <CButton color={canManage ? 'primary' : 'secondary'} variant={canManage ? undefined : 'outline'} size='sm' onClick={onClick}>
      {label}
    </CButton>
  )
}

export default function ExamConfigurationsOverviewPage({ onOpenTab, onCreateComponent, canManage = false, stats = [], statsLoading = false, statsError = '', onRetryStats }) {
  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard>
          <CCardBody>
            <div className='fs-5 fw-semibold mb-2'>Cấu hình dữ liệu nền cho hoạt động thi</div>
            <div className='text-body-secondary mb-2'>Các danh mục trong khu vực này được sử dụng để xây dựng môn thi, chương trình thi, chuẩn đầu ra và làm nguồn tạo cấu trúc cho các đợt thi.</div>
            <div className='text-body-secondary'>Người quản lý nên cấu hình từ đơn vị nhỏ nhất là kỹ năng thi, sau đó ghép thành môn thi, chương trình thi và chuẩn đầu ra.</div>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol xs={12}>
        <CCard>
          <CCardHeader><strong>Quy trình cấu hình</strong></CCardHeader>
          <CCardBody>
            <CRow className='g-3'>
              {STEPS.map((step, index) => (
                <CCol lg={4} md={6} key={step.title}>
                  <CCard className='h-100'>
                    <CCardBody>
                      <div className='small text-body-secondary mb-2'>Bước {index + 1}</div>
                      <div className='fw-semibold mb-2'>{step.title}</div>
                      <div className='text-body-secondary small mb-3'>{step.description}</div>
                      {index === 0 ? <FlowActionButton label={canManage ? 'Quản lý kỹ năng' : 'Xem kỹ năng'} canManage={canManage} onClick={() => onOpenTab?.('components')} /> : null}
                      {index === 1 ? <FlowActionButton label='Quản lý môn thi' canManage={canManage} onClick={() => onOpenTab?.('subjects')} /> : null}
                      {index === 2 ? <FlowActionButton label='Quản lý chương trình' canManage={canManage} onClick={() => onOpenTab?.('programs')} /> : null}
                      {index === 3 ? <FlowActionButton label='Quản lý chuẩn đầu ra' canManage={canManage} onClick={() => onOpenTab?.('outcomes')} /> : null}
                      {index === 4 ? <CBadge color='secondary'>Đợt thi được quản lý ở module riêng</CBadge> : null}
                    </CCardBody>
                  </CCard>
                </CCol>
              ))}
            </CRow>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol lg={8}>
        <CCard className='h-100'>
          <CCardHeader><strong>Quan hệ cấu hình</strong></CCardHeader>
          <CCardBody>
            <div className='fw-semibold mb-3'>Kỹ năng thi → Môn thi → Chương trình thi → Chuẩn đầu ra → Đợt thi</div>
            <div className='text-body-secondary'>Các danh mục nền được cấu hình trước để làm nguồn cho việc tạo cấu trúc và snapshot đợt thi ở các bước nghiệp vụ sau.</div>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol lg={4}>
        <CCard className='h-100'>
          <CCardHeader><strong>Quick actions</strong></CCardHeader>
          <CCardBody>
            <div className='d-grid gap-2'>
              <FlowActionButton label={canManage ? 'Tạo kỹ năng thi' : 'Xem kỹ năng thi'} canManage={canManage} onClick={() => (canManage ? onCreateComponent?.() : onOpenTab?.('components'))} />
              <FlowActionButton label='Quản lý môn thi' canManage={canManage} onClick={() => onOpenTab?.('subjects')} />
              <FlowActionButton label='Quản lý chương trình thi' canManage={canManage} onClick={() => onOpenTab?.('programs')} />
              <FlowActionButton label='Quản lý chuẩn đầu ra' canManage={canManage} onClick={() => onOpenTab?.('outcomes')} />
            </div>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol xs={12}>
        <CCard>
          <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-2'>
            <strong>Thống kê cấu hình</strong>
            {statsError && onRetryStats ? <CButton size='sm' color='secondary' variant='outline' onClick={onRetryStats}>Thử lại</CButton> : null}
          </CCardHeader>
          <CCardBody>
            {statsError ? (
              <CAlert color='warning' className='mb-0'>
                Không tải được số liệu thống kê từ backend hiện tại. Trang vẫn hiển thị phần giới thiệu và luồng nghiệp vụ bình thường.
              </CAlert>
            ) : (
              <CRow className='g-3'>
                {(stats || []).map((item) => (
                  <CCol xl={2} md={4} sm={6} key={item.key}>
                    <StatCard title={item.title} value={item.value} subtitle={item.subtitle} isLoading={statsLoading} />
                  </CCol>
                ))}
              </CRow>
            )}
          </CCardBody>
        </CCard>
      </CCol>

      <CCol xs={12}>
        <CAlert color='info' className='mb-0'>Các đợt thi đã tạo sử dụng bản snapshot riêng. Việc chỉnh sửa danh mục chỉ áp dụng cho những đợt thi được tạo sau đó và không tự động thay đổi cấu trúc của các đợt thi cũ.</CAlert>
      </CCol>
    </CRow>
  )
}