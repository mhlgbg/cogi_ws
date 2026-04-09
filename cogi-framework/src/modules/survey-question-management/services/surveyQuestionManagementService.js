import api from '../../../api/axios'

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data
  }
  return payload
}

export async function getSurveyQuestionManagementBootstrap() {
  const res = await api.get('/survey-question-management/bootstrap')
  return unwrapSuccess(res.data)
}

export async function getSurveyQuestions(params = {}) {
  const res = await api.get('/survey-question-management/questions', { params })
  return unwrapSuccess(res.data)
}

export async function createSurveyTemplate(payload) {
  const res = await api.post('/survey-question-management/templates', payload)
  return unwrapSuccess(res.data)
}

export async function updateSurveyTemplate(id, payload) {
  const res = await api.put(`/survey-question-management/templates/${id}`, payload)
  return unwrapSuccess(res.data)
}

export async function deleteSurveyTemplate(id) {
  const res = await api.delete(`/survey-question-management/templates/${id}`)
  return unwrapSuccess(res.data)
}

export async function createSurveySection(payload) {
  const res = await api.post('/survey-question-management/sections', payload)
  return unwrapSuccess(res.data)
}

export async function updateSurveySection(id, payload) {
  const res = await api.put(`/survey-question-management/sections/${id}`, payload)
  return unwrapSuccess(res.data)
}

export async function deleteSurveySection(id) {
  const res = await api.delete(`/survey-question-management/sections/${id}`)
  return unwrapSuccess(res.data)
}

export async function createSurveyQuestion(payload) {
  const res = await api.post('/survey-question-management/questions', payload)
  return unwrapSuccess(res.data)
}

export async function updateSurveyQuestion(id, payload) {
  const res = await api.put(`/survey-question-management/questions/${id}`, payload)
  return unwrapSuccess(res.data)
}

export async function deleteSurveyQuestion(id) {
  const res = await api.delete(`/survey-question-management/questions/${id}`)
  return unwrapSuccess(res.data)
}