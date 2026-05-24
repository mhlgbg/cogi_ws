import api from '../../../api/axios'

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data
  }
  return payload
}

export async function getLearningManagementBootstrap() {
  const res = await api.get('/learning-management/bootstrap')
  return unwrapSuccess(res.data)
}

export async function getLearningObjects(params = {}) {
  const res = await api.get('/learning-management/learning-objects', { params })
  return unwrapSuccess(res.data)
}

export async function getLearningObject(id) {
  const res = await api.get(`/learning-management/learning-objects/${id}`)
  return unwrapSuccess(res.data)
}

export async function createLearningObject(data) {
  const res = await api.post('/learning-management/learning-objects', data)
  return unwrapSuccess(res.data)
}

export async function updateLearningObject(id, data) {
  const res = await api.put(`/learning-management/learning-objects/${id}`, data)
  return unwrapSuccess(res.data)
}

export async function deleteLearningObject(id) {
  const res = await api.delete(`/learning-management/learning-objects/${id}`)
  return unwrapSuccess(res.data)
}

export async function getSubjects(params = {}) {
  const res = await api.get('/learning-management/subjects', { params })
  return unwrapSuccess(res.data)
}

export async function createSubject(data) {
  const res = await api.post('/learning-management/subjects', data)
  return unwrapSuccess(res.data)
}

export async function updateSubject(id, data) {
  const res = await api.put(`/learning-management/subjects/${id}`, data)
  return unwrapSuccess(res.data)
}

export async function deleteSubject(id) {
  const res = await api.delete(`/learning-management/subjects/${id}`)
  return unwrapSuccess(res.data)
}

export async function getGrades(params = {}) {
  const res = await api.get('/learning-management/grades', { params })
  return unwrapSuccess(res.data)
}

export async function createGrade(data) {
  const res = await api.post('/learning-management/grades', data)
  return unwrapSuccess(res.data)
}

export async function updateGrade(id, data) {
  const res = await api.put(`/learning-management/grades/${id}`, data)
  return unwrapSuccess(res.data)
}

export async function deleteGrade(id) {
  const res = await api.delete(`/learning-management/grades/${id}`)
  return unwrapSuccess(res.data)
}

export async function getKnowledgeNodes(params = {}) {
  const res = await api.get('/learning-management/knowledge-nodes', { params })
  return unwrapSuccess(res.data)
}

export async function createKnowledgeNode(data) {
  const res = await api.post('/learning-management/knowledge-nodes', data)
  return unwrapSuccess(res.data)
}

export async function getSkills(params = {}) {
  const res = await api.get('/learning-management/skills', { params })
  return unwrapSuccess(res.data)
}

export async function createSkill(data) {
  const res = await api.post('/learning-management/skills', data)
  return unwrapSuccess(res.data)
}

export async function getFormulas(params = {}) {
  const res = await api.get('/learning-management/formulas', { params })
  return unwrapSuccess(res.data)
}

export async function createFormula(data) {
  const res = await api.post('/learning-management/formulas', data)
  return unwrapSuccess(res.data)
}

export async function updateFormula(id, data) {
  const res = await api.put(`/learning-management/formulas/${id}`, data)
  return unwrapSuccess(res.data)
}

export async function deleteFormula(id) {
  const res = await api.delete(`/learning-management/formulas/${id}`)
  return unwrapSuccess(res.data)
}

export async function getVisualAssets(params = {}) {
  const res = await api.get('/learning-management/visual-assets', { params })
  return unwrapSuccess(res.data)
}

export async function createVisualAsset(data) {
  const res = await api.post('/learning-management/visual-assets', data)
  return unwrapSuccess(res.data)
}

export async function uploadMedia(file) {
  const formData = new FormData()
  formData.append('files', file)
  const res = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return Array.isArray(res.data) ? res.data[0] || null : null
}

export async function getContentBlocks(learningObjectId) {
  const res = await api.get(`/learning-management/learning-objects/${learningObjectId}/content-blocks`)
  return unwrapSuccess(res.data)
}

export async function createContentBlock(data) {
  const res = await api.post('/learning-management/content-blocks', data)
  return unwrapSuccess(res.data)
}

export async function updateContentBlock(id, data) {
  const res = await api.put(`/learning-management/content-blocks/${id}`, data)
  return unwrapSuccess(res.data)
}

export async function deleteContentBlock(id) {
  const res = await api.delete(`/learning-management/content-blocks/${id}`)
  return unwrapSuccess(res.data)
}

export async function getQuestions(params = {}) {
  const res = await api.get('/learning-management/questions', { params })
  return unwrapSuccess(res.data)
}

export async function createQuestion(data) {
  const res = await api.post('/learning-management/questions', data)
  return unwrapSuccess(res.data)
}

export async function updateQuestion(id, data) {
  const res = await api.put(`/learning-management/questions/${id}`, data)
  return unwrapSuccess(res.data)
}

export async function deleteQuestion(id) {
  const res = await api.delete(`/learning-management/questions/${id}`)
  return unwrapSuccess(res.data)
}

export async function createQuestionOption(data) {
  const res = await api.post('/learning-management/question-options', data)
  return unwrapSuccess(res.data)
}

export async function attachQuestionToLearningObject(learningObjectId, questionId) {
  const res = await api.post(`/learning-management/learning-objects/${learningObjectId}/attach-question`, { questionId })
  return unwrapSuccess(res.data)
}

export async function detachQuestionFromLearningObject(learningObjectId, questionId) {
  const res = await api.post(`/learning-management/learning-objects/${learningObjectId}/detach-question`, { questionId })
  return unwrapSuccess(res.data)
}
