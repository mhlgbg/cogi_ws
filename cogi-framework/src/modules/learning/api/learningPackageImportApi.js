import api from '../../../api/axios'

export async function previewLearningPackage(packageData) {
  const response = await api.post('/learning/package-import/preview', {
    package: packageData,
  })

  return response?.data?.data || response?.data || null
}

export async function confirmLearningPackage(packageData) {
  const response = await api.post('/learning/package-import/confirm', {
    package: packageData,
  })

  return response?.data?.data || response?.data || null
}
