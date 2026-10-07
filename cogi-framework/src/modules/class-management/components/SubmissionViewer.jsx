import { CBadge, CButton, CCard, CCardBody } from '@coreui/react'
import { getFileAssetUrl } from '../../learning-management/utils/questionBankUi'
import { sanitizeClassSessionContentHtml } from '../utils/classSessionContentHtml'
import { formatSessionDateTime } from '../utils/classSessionUi'
import { getSubmissionStatusMeta, getSubmissionVersionLabel } from './submissionViewerMeta'

function HtmlView({ value }) {
  const html = sanitizeClassSessionContentHtml(value || '')
  return html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <div className='text-body-secondary'>Chưa có nội dung.</div>
}

function formatFileSize(value) {
  const size = Number(value || 0)
  if (!Number.isFinite(size) || size <= 0) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function SubmissionItemView({ item }) {
  const assetUrl = item?.fileAsset ? getFileAssetUrl(item.fileAsset) : ''
  const fileName = item?.fileAsset?.originalName || item?.fileAsset?.fileName || 'Tệp đính kèm'
  const fileMeta = [item?.fileAsset?.mimeType, formatFileSize(item?.fileAsset?.size)].filter(Boolean).join(' · ')

  return (
    <CCard className='border-0 shadow-sm'>
      <CCardBody className='d-flex flex-column gap-3'>
        <div className='d-flex justify-content-between align-items-start gap-2 flex-wrap'>
          <div>
            <div className='fw-semibold text-uppercase small'>{item?.type || 'file'}</div>
            {item?.caption ? <div className='text-body-secondary'>{item.caption}</div> : null}
          </div>
        </div>

        {item?.type === 'html' ? <HtmlView value={item?.contentHtml} /> : null}

        {item?.type === 'link' ? (
          <div className='d-flex flex-column gap-2'>
            <div>
              <div className='small text-body-secondary'>URL</div>
              <div className='text-break'>{item?.url || '-'}</div>
            </div>
            {item?.url ? <div><CButton component='a' href={item.url} target='_blank' rel='noopener noreferrer' color='primary' variant='outline' size='sm'>Mở liên kết</CButton></div> : null}
          </div>
        ) : null}

        {item?.type === 'image' && assetUrl ? <img src={assetUrl} alt={item?.caption || 'submission'} style={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain', borderRadius: 12 }} /> : null}
        {item?.type === 'video' && assetUrl ? <video controls preload='metadata' src={assetUrl} style={{ width: '100%', maxHeight: 420, borderRadius: 12 }} /> : null}
        {item?.type === 'audio' && assetUrl ? <audio controls preload='none' src={assetUrl} style={{ width: '100%' }} /> : null}

        {item?.type === 'file' ? (
          <div className='d-flex flex-column gap-2'>
            <div>
              <div className='fw-semibold'>{fileName}</div>
              {fileMeta ? <div className='small text-body-secondary'>{fileMeta}</div> : null}
            </div>
            {assetUrl ? (
              <div className='d-flex gap-2 flex-wrap'>
                <CButton component='a' href={assetUrl} target='_blank' rel='noopener noreferrer' color='primary' variant='outline' size='sm'>Xem</CButton>
                <CButton component='a' href={assetUrl} target='_blank' rel='noopener noreferrer' download={fileName} color='secondary' variant='outline' size='sm'>Tải</CButton>
              </div>
            ) : <div className='text-body-secondary'>Không có tệp để hiển thị.</div>}
          </div>
        ) : null}
      </CCardBody>
    </CCard>
  )
}

export default function SubmissionViewer({ submission = null, title = '', showHeader = true }) {
  if (!submission) {
    return <div className='text-body-secondary'>Không có dữ liệu bài nộp.</div>
  }

  const statusMeta = getSubmissionStatusMeta(submission.status)
  const items = Array.isArray(submission.items) ? [...submission.items].sort((left, right) => {
    const leftOrder = Number(left?.order || 0) || 0
    const rightOrder = Number(right?.order || 0) || 0
    if (leftOrder !== rightOrder) return leftOrder - rightOrder
    return (Number(left?.id || 0) || 0) - (Number(right?.id || 0) || 0)
  }) : []

  return (
    <div className='d-flex flex-column gap-3'>
      {showHeader ? (
        <div className='border rounded-3 p-3 bg-body-tertiary'>
          <div className='d-flex justify-content-between align-items-start gap-2 flex-wrap'>
            <div>
              <div className='fw-semibold'>{title || getSubmissionVersionLabel(submission.version)}</div>
              <div className='small text-body-secondary'>Bài đã nộp ở chế độ chỉ xem.</div>
            </div>
            <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge>
          </div>
          <div className='row g-3 mt-1'>
            <div className='col-md-4'>
              <div className='small text-body-secondary'>Nộp lúc</div>
              <div>{submission?.submittedAt ? formatSessionDateTime(submission.submittedAt) : 'Chưa nộp'}</div>
            </div>
            <div className='col-md-4'>
              <div className='small text-body-secondary'>Trạng thái</div>
              <div>{statusMeta.label}</div>
            </div>
            <div className='col-md-4'>
              <div className='small text-body-secondary'>Phiên bản</div>
              <div>{getSubmissionVersionLabel(submission.version)}</div>
            </div>
          </div>
          {submission?.comment ? (
            <div className='mt-3'>
              <div className='small text-body-secondary'>Ghi chú của học sinh</div>
              <div>{submission.comment}</div>
            </div>
          ) : null}
        </div>
      ) : null}

      {items.length > 0 ? items.map((item) => <SubmissionItemView key={item.id || `${item.type}-${item.order}`} item={item} />) : <div className='text-body-secondary'>Bài nộp này chưa có nội dung.</div>}
    </div>
  )
}