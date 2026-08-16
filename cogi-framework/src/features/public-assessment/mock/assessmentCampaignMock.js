export const mockCampaigns = {
  'english-level-check': {
    code: 'english-level-check',
    title: 'Vitaminfun English Level Check',
    shortTitle: 'English Level Check',
    badge: 'ENGLISH LEVEL CHECK',
    headline: 'Kiểm tra trình độ tiếng Anh của con',
    description: 'Bài đánh giá trực tuyến giúp xác định năng lực hiện tại theo từng kỹ năng và hỗ trợ giáo viên tư vấn lộ trình học phù hợp.',
    estimatedMinutes: '20–30 phút',
    highlights: ['20–30 phút', 'Làm trực tuyến', 'Có giáo viên xác nhận'],
    steps: [
      'Điền thông tin',
      'Xác thực email',
      'Làm bài kiểm tra',
      'Nhận kết quả sơ bộ',
      'Speaking cùng giáo viên',
    ],
    domains: [
      { key: 'listening', title: 'Listening', description: 'Đánh giá khả năng nghe hiểu trên nền tảng trực tuyến.' },
      { key: 'reading', title: 'Reading', description: 'Đánh giá khả năng đọc hiểu với nội dung phù hợp độ tuổi.' },
      { key: 'language', title: 'Language in Use', description: 'Đánh giá ngữ pháp, từ vựng và cách sử dụng ngôn ngữ.' },
      { key: 'writing', title: 'Writing', description: 'Đánh giá khả năng diễn đạt bằng viết ở mức phù hợp.' },
      { key: 'speaking', title: 'Speaking', description: 'Bước xác nhận tiếp theo cùng giáo viên sau phần làm bài online.' },
    ],
    trustInfo: [
      'Đây là bài đánh giá đầu vào, không phải kỳ thi cấp chứng chỉ.',
      'Kết quả online ban đầu là kết quả sơ bộ.',
      'Sau phần Speaking, giáo viên sẽ xem xét và xác nhận mức độ phù hợp trước khi tư vấn lớp học và lộ trình.',
    ],
    registerIntro: {
      title: 'Thông tin trước khi làm bài',
      description: 'Vui lòng cung cấp một số thông tin để Vitaminfun lựa chọn bài đánh giá phù hợp và tư vấn kết quả chính xác hơn.',
      stepLabel: 'Bước 1/5',
      stepTitle: 'Thông tin ban đầu',
    },
  },
}

export function getMockAssessmentCampaign(campaignCode) {
  return mockCampaigns[String(campaignCode || '').trim()] || null
}

export const provinceOptions = [
  'Hà Nội',
  'TP. Hồ Chí Minh',
  'Hải Phòng',
  'Đà Nẵng',
  'Khác',
]

export const districtOptionsByProvince = {
  'Hà Nội': ['Long Biên', 'Hoàn Kiếm', 'Ba Đình', 'Hai Bà Trưng', 'Cầu Giấy', 'Gia Lâm', 'Khác'],
}

export const gradeOptions = [
  'Lớp 1',
  'Lớp 2',
  'Lớp 3',
  'Lớp 4',
  'Lớp 5',
  'Lớp 6',
  'Lớp 7',
  'Lớp 8',
  'Lớp 9',
  'Lớp 10',
  'Lớp 11',
  'Lớp 12',
]

export const currentEnglishStudyOptions = [
  { value: 'not_yet', label: 'Chưa học thêm' },
  { value: 'language_center', label: 'Đang học tại trung tâm tiếng Anh' },
  { value: 'private_teacher', label: 'Đang học cùng giáo viên' },
  { value: 'self_online', label: 'Tự học / học online' },
  { value: 'other', label: 'Khác' },
]

export const goalOptions = [
  { value: 'school_support', label: 'Củng cố tiếng Anh ở trường' },
  { value: 'communication', label: 'Giao tiếp' },
  { value: 'cambridge', label: 'Cambridge' },
  { value: 'ielts', label: 'IELTS' },
  { value: 'specialized_school', label: 'Thi vào trường chất lượng cao' },
  { value: 'long_term_foundation', label: 'Phát triển nền tảng lâu dài' },
]

export const studyModeOptions = [
  { value: 'online', label: 'Online' },
  { value: 'offline_viet_hung', label: 'Offline tại Việt Hưng' },
  { value: 'online_or_offline', label: 'Cả Online và Offline đều được' },
  { value: 'undecided', label: 'Chưa quyết định' },
]

export const availableDayOptions = [
  { value: 'mon', label: 'Thứ 2' },
  { value: 'tue', label: 'Thứ 3' },
  { value: 'wed', label: 'Thứ 4' },
  { value: 'thu', label: 'Thứ 5' },
  { value: 'fri', label: 'Thứ 6' },
  { value: 'sat', label: 'Thứ 7' },
  { value: 'sun', label: 'Chủ nhật' },
]

export const availableTimeOptions = [
  { value: 'morning', label: 'Buổi sáng' },
  { value: 'afternoon', label: 'Buổi chiều' },
  { value: '17_00_18_30', label: '17:00–18:30' },
  { value: '18_30_20_00', label: '18:30–20:00' },
  { value: 'after_20', label: 'Sau 20:00' },
]

export const startIntentOptions = [
  { value: 'asap', label: 'Ngay khi có lớp phù hợp' },
  { value: 'within_2_weeks', label: 'Trong 1–2 tuần tới' },
  { value: 'within_30_days', label: 'Trong 30 ngày tới' },
  { value: 'undecided', label: 'Chưa xác định' },
]
