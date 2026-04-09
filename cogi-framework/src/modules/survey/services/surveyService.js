import api from '../../../api/axios'

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data
  }
  return payload
}

export async function getMySurveyAssignments() {
  const res = await api.get('/survey/my-assignments')
  return unwrapSuccess(res.data)
}

export async function getSurveyAssignmentDetail(assignmentId) {
  const res = await api.get(`/survey/assignment/${assignmentId}`)
  return unwrapSuccess(res.data)
}

export async function saveSurveyDraft(assignmentId, answers) {
  const res = await api.post('/survey/save-draft', {
    assignmentId,
    answers,
  })
  return unwrapSuccess(res.data)
}

export async function submitSurvey(assignmentId, answers) {
  const res = await api.post('/survey/submit', {
    assignmentId,
    answers,
  })
  return unwrapSuccess(res.data)
}