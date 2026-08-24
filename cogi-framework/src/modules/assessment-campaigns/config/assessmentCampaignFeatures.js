const assessmentCampaignFeatures = {
  group: {
    name: 'Chiến dịch đánh giá',
    code: 'assessment-campaign',
    order: 90,
    icon: 'cilBullhorn',
  },
  features: [
    {
      name: 'Chiến dịch đánh giá',
      key: 'assessment-campaign.manage',
      order: 1,
      description: 'Quản lý các chiến dịch sử dụng bài đánh giá để thu lead, phân bài kiểm tra và theo dõi kết quả',
      path: '/assessment-campaigns',
      showInMenu: true,
    },
  ],
}

export default assessmentCampaignFeatures