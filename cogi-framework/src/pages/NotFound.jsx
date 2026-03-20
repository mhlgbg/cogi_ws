import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>404 - Không tìm thấy trang</h2>
      <p>Đường dẫn bạn truy cập không tồn tại hoặc đã được thay đổi.</p>
      <button
        type="button"
        onClick={() => navigate('/', { replace: true })}
        style={{ padding: '8px 12px', cursor: 'pointer' }}
      >
        Quay về trang chủ
      </button>
    </div>
  )
}
