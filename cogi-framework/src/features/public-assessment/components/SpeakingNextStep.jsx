import { CButton } from '@coreui/react'

export default function SpeakingNextStep({ onChooseLive, onChooseAudio }) {
  return (
    <section className='assessment-speaking-next-step' aria-labelledby='assessment-speaking-next-step-title'>
      <div className='assessment-speaking-next-step__intro'>
        <div className='assessment-badge'>Bước tiếp theo</div>
        <h2 id='assessment-speaking-next-step-title' className='assessment-form-section-title mb-2'>Speaking cùng giáo viên</h2>
        <p className='assessment-section-lead'>Để giáo viên xác nhận mức phù hợp, học sinh cần hoàn thành một phần Speaking ngắn.</p>
      </div>

      <div className='assessment-speaking-option-grid'>
        <article className='assessment-speaking-option-card'>
          <div className='assessment-speaking-option-card__eyebrow'>Live Speaking</div>
          <h3 className='assessment-speaking-option-card__title'>Đặt lịch Speaking</h3>
          <p className='assessment-speaking-option-card__copy'>Trao đổi trực tiếp với giáo viên trong khoảng 5–7 phút.</p>
          <CButton color='primary' className='assessment-primary-cta w-100' onClick={onChooseLive}>ĐẶT LỊCH SPEAKING</CButton>
        </article>

        <article className='assessment-speaking-option-card'>
          <div className='assessment-speaking-option-card__eyebrow'>Send Audio</div>
          <h3 className='assessment-speaking-option-card__title'>Gửi audio Speaking</h3>
          <p className='assessment-speaking-option-card__copy'>Phù hợp nếu phụ huynh chưa tiện đặt lịch ngay.</p>
          <CButton color='secondary' variant='outline' className='assessment-primary-cta w-100' onClick={onChooseAudio}>GỬI AUDIO SPEAKING</CButton>
        </article>
      </div>
    </section>
  )
}
