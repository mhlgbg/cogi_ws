export default function AssessmentProgress({ currentStep, totalSteps, label }) {
  return (
    <div className='assessment-form-progress'>
      <span>{`Bước ${currentStep}/${totalSteps}`}</span>
      <span className='assessment-form-progress-muted'>{label}</span>
    </div>
  )
}
