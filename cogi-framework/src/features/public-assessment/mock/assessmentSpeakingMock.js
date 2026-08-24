function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function formatDateLabel(date) {
  const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'long' }).format(date)
  const dayMonth = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(date)
  const normalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1)
  return `${normalizedWeekday}, ${dayMonth}`
}

function buildDateWithOffset(offsetDays) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offsetDays)
  return date
}

export function getMockSpeakingSlots() {
  const dayOne = buildDateWithOffset(1)
  const dayTwo = buildDateWithOffset(2)
  const dayThree = buildDateWithOffset(4)

  return [
    {
      date: formatDateKey(dayOne),
      label: formatDateLabel(dayOne),
      times: ['17:30', '18:00', '18:30'],
    },
    {
      date: formatDateKey(dayTwo),
      label: formatDateLabel(dayTwo),
      times: ['09:00', '09:30', '14:00', '14:30'],
    },
    {
      date: formatDateKey(dayThree),
      label: formatDateLabel(dayThree),
      times: ['19:00', '19:30'],
    },
  ]
}

export const assessmentSpeakingPrompts = [
  {
    id: 'prompt_1',
    title: 'Prompt 1',
    prompt: 'Introduce yourself and tell us about your school.',
    helper: 'Hãy giới thiệu ngắn gọn về bản thân và trường em đang học.',
  },
  {
    id: 'prompt_2',
    title: 'Prompt 2',
    prompt: 'What do you enjoy doing in your free time? Why?',
    helper: 'Em thích làm gì khi rảnh và vì sao?',
  },
  {
    id: 'prompt_3',
    title: 'Prompt 3',
    prompt: 'Describe a memorable day or experience.',
    helper: 'Hãy kể về một ngày hoặc trải nghiệm đáng nhớ.',
  },
]
