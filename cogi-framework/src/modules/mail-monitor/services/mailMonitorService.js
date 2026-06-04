import api from '../../../api/axios'

export async function getMailMonitorLogs(params = {}) {
  const res = await api.get('/mail-monitor/logs', { params })
  return res.data || { data: [], meta: {} }
}

export async function getMailMonitorLogDetail(id) {
  const res = await api.get(`/mail-monitor/logs/${id}`)
  return res.data?.data || null
}

export async function getMailMonitorStats(params = {}) {
  const res = await api.get('/mail-monitor/stats', { params })
  return res.data?.data || {}
}

export async function requeueMailMonitorLog(id) {
  const res = await api.post(`/mail-monitor/logs/${id}/requeue`)
  return res.data || {}
}

export async function resendMailMonitorLog(id) {
  const res = await api.post(`/mail-monitor/logs/${id}/resend`)
  return res.data || {}
}

export async function sendNowMailMonitorLog(id) {
  const res = await api.post(`/mail-monitor/logs/${id}/send-now`)
  return res.data || {}
}

export async function cancelMailMonitorLog(id) {
  const res = await api.post(`/mail-monitor/logs/${id}/cancel`)
  return res.data || {}
}

export async function sendMailMonitorTestMail(payload = {}) {
  const res = await api.post('/mail-monitor/test-send', payload)
  return res.data || {}
}