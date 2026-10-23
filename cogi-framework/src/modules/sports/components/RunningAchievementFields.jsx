import { CCol, CFormInput, CFormLabel, CFormSelect, CRow } from '@coreui/react'
import {
  RACE_TYPE_OPTIONS,
  RUNNING_DISTANCE_OPTIONS,
  buildRaceResultTitleSuggestion,
  formatDistanceKm,
  formatDurationSeconds,
} from '../utils/sportsAchievementUi'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function normalizeDistanceValue(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Number(parsed.toFixed(3))
}

function getDistancePreset(distanceKm, distancePending = false) {
  if (distancePending) return 'unknown'
  const normalized = normalizeDistanceValue(distanceKm)
  if (normalized === null) return ''
  if (Math.abs(normalized - 42.195) < 0.0001) return '42.195'
  if (Math.abs(normalized - 21.0975) < 0.0001) return '21.0975'
  if (Math.abs(normalized - 10) < 0.0001) return '10'
  if (Math.abs(normalized - 5) < 0.0001) return '5'
  return 'other'
}

export function buildRunningAchievementState(initialValues = null) {
  const totalSeconds = Number(initialValues?.durationSeconds || 0)
  const safeTotalSeconds = Number.isInteger(totalSeconds) && totalSeconds > 0 ? totalSeconds : 0
  return {
    eventCode: toText(initialValues?.eventCode),
    bib: toText(initialValues?.bib),
    raceType: toText(initialValues?.raceType),
    distancePending: Boolean(initialValues?.distancePending),
    distancePreset: getDistancePreset(initialValues?.distanceKm, Boolean(initialValues?.distancePending)),
    customDistanceKm: getDistancePreset(initialValues?.distanceKm, Boolean(initialValues?.distancePending)) === 'other'
      ? toText(initialValues?.distanceKm)
      : '',
    durationHours: safeTotalSeconds > 0 ? String(Math.floor(safeTotalSeconds / 3600)) : '',
    durationMinutes: safeTotalSeconds > 0 ? String(Math.floor((safeTotalSeconds % 3600) / 60)).padStart(2, '0') : '',
    durationSecondsPart: safeTotalSeconds > 0 ? String(safeTotalSeconds % 60).padStart(2, '0') : '',
  }
}

export function isRunningDistanceOther(distancePreset) {
  return toText(distancePreset) === 'other'
}

export function buildRunningAchievementPayload(form) {
  const distancePreset = toText(form.distancePreset)
  const distancePending = Boolean(form.distancePending) || distancePreset === 'unknown'
  const distanceKm = distancePending
    ? null
    : (distancePreset && distancePreset !== 'other'
      ? normalizeDistanceValue(distancePreset)
      : normalizeDistanceValue(form.customDistanceKm))

  const hours = Number(toText(form.durationHours) || 0)
  const minutes = Number(toText(form.durationMinutes) || 0)
  const seconds = Number(toText(form.durationSecondsPart) || 0)
  const hasDuration = Number.isInteger(hours) && Number.isInteger(minutes) && Number.isInteger(seconds)
  const durationSeconds = hasDuration ? (hours * 3600) + (minutes * 60) + seconds : null

  return {
    eventCode: toText(form.eventCode || ''),
    bib: toText(form.bib || ''),
    raceType: toText(form.raceType || ''),
    distancePending,
    distanceKm,
    durationSeconds: durationSeconds && durationSeconds > 0 ? durationSeconds : null,
    resultValue: durationSeconds && durationSeconds > 0 ? durationSeconds : null,
    resultUnit: durationSeconds && durationSeconds > 0 ? 'seconds' : null,
    resultText: durationSeconds && durationSeconds > 0 ? formatDurationSeconds(durationSeconds) : null,
  }
}

export function validateRunningAchievementForm(form) {
  const errors = {}
  if (!toText(form.title)) errors.title = 'Tên giải chạy là bắt buộc'
  if (!toText(form.achievedAt)) errors.achievedAt = 'Ngày đạt thành tích là bắt buộc'

  const distancePreset = toText(form.distancePreset)
  if (distancePreset === 'unknown') {
    // Backend accepts field as distancePending when the distance is not available yet.
  } else if (!distancePreset) {
    errors.distanceKm = 'Cự ly là bắt buộc'
  } else if (distancePreset === 'other') {
    const customDistance = Number(form.customDistanceKm)
    if (!Number.isFinite(customDistance) || customDistance <= 0) {
      errors.distanceKm = 'Cự ly khác phải là số dương hợp lệ'
    }
  }

  const hoursText = toText(form.durationHours)
  const minutesText = toText(form.durationMinutes)
  const secondsText = toText(form.durationSecondsPart)
  const hours = hoursText ? Number(hoursText) : 0
  const minutes = minutesText ? Number(minutesText) : 0
  const seconds = secondsText ? Number(secondsText) : 0

  if (!Number.isInteger(hours) || hours < 0) errors.durationHours = 'Giờ phải là số nguyên không âm'
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) errors.durationMinutes = 'Phút phải từ 0 đến 59'
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 59) errors.durationSecondsPart = 'Giây phải từ 0 đến 59'

  const totalSeconds = (Number.isInteger(hours) ? hours : 0) * 3600
    + (Number.isInteger(minutes) ? minutes : 0) * 60
    + (Number.isInteger(seconds) ? seconds : 0)
  if (totalSeconds <= 0) errors.durationTotal = 'Thời gian hoàn thành phải lớn hơn 0'

  return errors
}

export default function RunningAchievementFields({ form, errors = {}, disabled = false, onChange }) {
  const distancePreview = (() => {
    const payload = buildRunningAchievementPayload(form)
    return payload.distanceKm ? formatDistanceKm(payload.distanceKm) : (payload.distancePending ? 'Chưa xác định' : '-')
  })()
  const durationPreview = (() => {
    const payload = buildRunningAchievementPayload(form)
    return payload.durationSeconds ? formatDurationSeconds(payload.durationSeconds) : '--:--:--'
  })()

  function handleRaceMetaChange(key, value) {
    const nextValue = value
    if ((key === 'eventCode' || key === 'bib') && !toText(form.title).trim()) {
      const suggestion = buildRaceResultTitleSuggestion({
        title: form.title,
        eventCode: key === 'eventCode' ? nextValue : form.eventCode,
        bib: key === 'bib' ? nextValue : form.bib,
      })
      if (suggestion) onChange('title', suggestion)
    }
    onChange(key, nextValue)
  }

  return (
    <CRow className='g-3'>
      <CCol md={4}>
        <CFormLabel>Mã giải (eventCode)</CFormLabel>
        <CFormInput value={form.eventCode || ''} onChange={(event) => handleRaceMetaChange('eventCode', event.target.value)} disabled={disabled} />
      </CCol>
      <CCol md={4}>
        <CFormLabel>BIB</CFormLabel>
        <CFormInput value={form.bib || ''} onChange={(event) => handleRaceMetaChange('bib', event.target.value)} disabled={disabled} />
      </CCol>
      <CCol md={4}>
        <CFormLabel>Loại đường chạy</CFormLabel>
        <CFormSelect value={form.raceType || ''} onChange={(event) => onChange('raceType', event.target.value)} disabled={disabled}>
          <option value=''>Chưa xác định</option>
          {RACE_TYPE_OPTIONS.filter((option) => option.value).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </CFormSelect>
      </CCol>
      <CCol md={8}>
        <CFormLabel>Tên giải chạy *</CFormLabel>
        <CFormInput value={form.title} onChange={(event) => onChange('title', event.target.value)} disabled={disabled} invalid={Boolean(errors.title)} />
        {errors.title ? <div className='text-danger small mt-1'>{errors.title}</div> : null}
      </CCol>
      <CCol md={4}>
        <CFormLabel>Ngày đạt thành tích *</CFormLabel>
        <CFormInput type='date' value={form.achievedAt} onChange={(event) => onChange('achievedAt', event.target.value)} disabled={disabled} invalid={Boolean(errors.achievedAt)} />
        {errors.achievedAt ? <div className='text-danger small mt-1'>{errors.achievedAt}</div> : null}
      </CCol>
      <CCol md={4}>
        <CFormLabel>Cự ly *</CFormLabel>
        <CFormSelect value={form.distancePreset || ''} onChange={(event) => onChange('distancePreset', event.target.value)} disabled={disabled} invalid={Boolean(errors.distanceKm)}>
          <option value=''>Chọn cự ly</option>
          {RUNNING_DISTANCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </CFormSelect>
        {errors.distanceKm ? <div className='text-danger small mt-1'>{errors.distanceKm}</div> : null}
      </CCol>
      {isRunningDistanceOther(form.distancePreset) ? (
        <CCol md={4}>
          <CFormLabel>Nhập cự ly khác (km) *</CFormLabel>
          <CFormInput type='number' step='0.001' min='0.001' value={form.customDistanceKm} onChange={(event) => onChange('customDistanceKm', event.target.value)} disabled={disabled} invalid={Boolean(errors.distanceKm)} />
        </CCol>
      ) : null}
      <CCol md={4}>
        <CFormLabel>Cự ly hiển thị</CFormLabel>
        <CFormInput value={distancePreview} disabled readOnly />
      </CCol>
      <CCol md={4}>
        <CFormLabel>Giờ</CFormLabel>
        <CFormInput type='number' min='0' step='1' value={form.durationHours} onChange={(event) => onChange('durationHours', event.target.value)} disabled={disabled} invalid={Boolean(errors.durationHours || errors.durationTotal)} />
        {errors.durationHours ? <div className='text-danger small mt-1'>{errors.durationHours}</div> : null}
      </CCol>
      <CCol md={4}>
        <CFormLabel>Phút</CFormLabel>
        <CFormInput type='number' min='0' max='59' step='1' value={form.durationMinutes} onChange={(event) => onChange('durationMinutes', event.target.value)} disabled={disabled} invalid={Boolean(errors.durationMinutes || errors.durationTotal)} />
        {errors.durationMinutes ? <div className='text-danger small mt-1'>{errors.durationMinutes}</div> : null}
      </CCol>
      <CCol md={4}>
        <CFormLabel>Giây</CFormLabel>
        <CFormInput type='number' min='0' max='59' step='1' value={form.durationSecondsPart} onChange={(event) => onChange('durationSecondsPart', event.target.value)} disabled={disabled} invalid={Boolean(errors.durationSecondsPart || errors.durationTotal)} />
        {errors.durationSecondsPart ? <div className='text-danger small mt-1'>{errors.durationSecondsPart}</div> : null}
      </CCol>
      <CCol md={4}>
        <CFormLabel>Thời gian hiển thị</CFormLabel>
        <CFormInput value={durationPreview} disabled readOnly />
        {errors.durationTotal ? <div className='text-danger small mt-1'>{errors.durationTotal}</div> : null}
      </CCol>
      <CCol md={8}>
        <CFormLabel>Liên kết minh chứng</CFormLabel>
        <CFormInput value={form.sourceReference} onChange={(event) => onChange('sourceReference', event.target.value)} disabled={disabled} placeholder='Link kết quả chính thức, Strava hoặc nguồn minh chứng hợp lệ' />
      </CCol>
    </CRow>
  )
}
