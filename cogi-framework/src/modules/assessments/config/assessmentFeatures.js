const assessmentFeatures = {
  group: {
    name: 'Ngân hàng đề',
    code: 'assessments',
    order: 14,
    icon: 'cilClipboard',
  },
  features: [
    {
      name: 'Ngân hàng đề',
      key: 'learning.assessment.manage',
      order: 1,
      description: 'Quản lý đề, phiên bản, cấu trúc và câu hỏi dùng cho kiểm tra và đánh giá',
      path: '/assessments',
      showInMenu: true,
    },
    {
      name: 'Kết quả đánh giá',
      key: 'learning.assessment.manage',
      order: 2,
      description: 'Theo dõi kết quả các lượt làm bài, điểm tự động, nội dung chờ chấm và kết quả xếp mức sơ bộ',
      path: '/assessment-results',
      showInMenu: true,
    },
  ],
}

export default assessmentFeatures
