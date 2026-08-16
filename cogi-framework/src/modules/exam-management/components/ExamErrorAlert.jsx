import { CAlert } from '@coreui/react'
import { getExamErrorCode } from '../utils/examRoundUi'

export default function ExamErrorAlert({ message = '', code = '', details = [] }) {
  if (!message) return null

  return (
    <CAlert color='danger'>
      <div className='fw-semibold mb-1'>{message}</div>
      {code ? <div className='small text-body-secondary mb-2'>Mã lỗi: {code}</div> : null}
      {Array.isArray(details) && details.length > 0 ? (
        <ul className='mb-0 ps-3'>
          {details.map((item, index) => (
            <li key={`${item?.path || 'error'}:${index}`}>
              <strong>{item?.code || getExamErrorCode(item) || 'Lỗi'}</strong>
              {item?.path ? ` - ${item.path}` : ''}
              {item?.message ? `: ${item.message}` : ''}
            </li>
          ))}
        </ul>
      ) : null}
    </CAlert>
  )
}