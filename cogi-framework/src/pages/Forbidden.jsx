import { useNavigate } from 'react-router-dom'

export default function Forbidden() {
  const navigate = useNavigate()

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>403 - Không có quyền truy cập</h2>
      <p>Bạn không được cấp quyền sử dụng chức năng này trong tenant hiện tại.</p>
      <button
        type="button"
        onClick={() => navigate('/', { replace: true })}
        style={{ padding: '8px 12px', cursor: 'pointer' }}
      >
        Quay về dashboard
      </button>
    </div>
  )
}
