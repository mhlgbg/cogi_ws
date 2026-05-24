const surveyAnalysisFeatures = {
  group: {
    name: 'Survey',
    code: 'survey',
    order: 12,
    icon: 'cilDescription',
  },
  features: [
    {
      name: 'Phân tích khảo sát ĐH Công Đoàn',
      key: 'survey.analysis.dhcd',
      order: 4,
      description: 'Phân tích tiến độ khảo sát từ file Excel cho tenant ĐH Công Đoàn',
      path: '/survey-analysis/dhcd',
      showInMenu: true,
    },
  ],
}

export default surveyAnalysisFeatures
