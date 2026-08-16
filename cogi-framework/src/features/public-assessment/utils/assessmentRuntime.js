export const OTP_DEMO_CODE = '123456'
export const OTP_LOCK_SECONDS = 600
export const OTP_RESEND_SECONDS = 60

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export function maskEmail(email) {
  const normalized = toText(email)
  const [localPart = '', domain = ''] = normalized.split('@')
  if (!localPart || !domain) return normalized
  const visible = localPart.slice(0, Math.min(3, localPart.length))
  return `${visible}***@${domain}`
}

export function resolveMockTestByGrade(gradeLabel) {
  const gradeText = toText(gradeLabel)
  const gradeNumberMatch = gradeText.match(/(\d{1,2})/)
  const gradeNumber = Number(gradeNumberMatch?.[1] || 0)

  if (gradeNumber >= 1 && gradeNumber <= 2) {
    return { code: 'p1_mini_check', title: 'P1 Mini Check', gradeRange: 'Lớp 1–2', estimatedMinutes: '20–30 phút' }
  }
  if (gradeNumber >= 3 && gradeNumber <= 5) {
    return { code: 'p2_primary', title: 'P2 Primary English Level Check', gradeRange: 'Lớp 3–5', estimatedMinutes: '20–30 phút' }
  }
  if (gradeNumber >= 6 && gradeNumber <= 9) {
    return { code: 'secondary', title: 'Secondary English Level Check', gradeRange: 'Lớp 6–9', estimatedMinutes: '20–30 phút' }
  }
  return { code: 'high_school', title: 'High School English Level Check', gradeRange: 'Lớp 10–12', estimatedMinutes: '20–30 phút' }
}

export function createMockAudioSampleDataUri() {
  const sampleRate = 8000
  const durationSeconds = 1.2
  const frameCount = Math.floor(sampleRate * durationSeconds)
  const wavHeaderSize = 44
  const dataSize = frameCount * 2
  const buffer = new ArrayBuffer(wavHeaderSize + dataSize)
  const view = new DataView(buffer)

  function writeString(offset, value) {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  const frequency = 523.25
  const fadeFrames = Math.floor(sampleRate * 0.08)
  for (let index = 0; index < frameCount; index += 1) {
    const time = index / sampleRate
    const fadeIn = Math.min(1, index / fadeFrames)
    const fadeOut = Math.min(1, (frameCount - index) / fadeFrames)
    const amplitude = 0.32 * Math.min(fadeIn, fadeOut)
    const sample = Math.sin(2 * Math.PI * frequency * time) * amplitude
    view.setInt16(wavHeaderSize + (index * 2), Math.max(-1, Math.min(1, sample)) * 32767, true)
  }

  const bytes = new Uint8Array(buffer)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return `data:audio/wav;base64,${btoa(binary)}`
}
