function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

const secondaryPreliminaryResultMock = {
  status: 'PROVISIONAL',
  overallLabel: 'Kết quả sơ bộ',
  domains: [
    {
      code: 'listening',
      label: 'Listening',
      rawScoreLabel: '8/10',
      level: 'A2',
      confidence: 'good',
      shortStatus: 'Nền tảng nghe đang hình thành rõ.',
    },
    {
      code: 'reading',
      label: 'Reading',
      rawScoreLabel: '7/10',
      level: 'B1',
      confidence: 'good',
      shortStatus: 'Đọc hiểu tốt với văn bản phù hợp độ tuổi.',
    },
    {
      code: 'language',
      label: 'Language in Use',
      rawScoreLabel: '7/10',
      level: 'B1',
      confidence: 'supporting',
      shortStatus: 'Bằng chứng bổ trợ về từ vựng và ngữ pháp.',
    },
    {
      code: 'writing',
      label: 'Writing',
      rawScoreLabel: null,
      level: 'A2',
      confidence: 'preliminary',
      shortStatus: 'Đánh giá sơ bộ từ phần làm bài online.',
    },
  ],
  provisionalLevel: 'A2+',
  strengths: [
    'Khả năng đọc hiểu tốt với nội dung phù hợp độ tuổi.',
    'Vốn từ và ngữ pháp hỗ trợ khá tốt cho việc tiếp nhận nội dung.',
  ],
  priorities: [
    'Cần tăng khả năng nghe chi tiết trong hội thoại.',
    'Cần phát triển độ chính xác và tự nhiên khi diễn đạt bằng viết.',
  ],
}

const preliminaryResultMocksByTestCode = {
  secondary: secondaryPreliminaryResultMock,
  p1_mini_check: {
    ...secondaryPreliminaryResultMock,
    provisionalLevel: 'A1+',
  },
  p2_primary: {
    ...secondaryPreliminaryResultMock,
    provisionalLevel: 'A2',
  },
  high_school: {
    ...secondaryPreliminaryResultMock,
    provisionalLevel: 'B1',
  },
}

export function getMockAssessmentPreliminaryResult(testCode) {
  return clone(preliminaryResultMocksByTestCode[String(testCode || '').trim()] || secondaryPreliminaryResultMock)
}
