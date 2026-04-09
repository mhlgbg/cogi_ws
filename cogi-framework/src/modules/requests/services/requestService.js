import api from '../../../api/axios'

function normalizeRequestStatus(raw) {
  if (!raw || typeof raw !== 'object') return raw

  const requestStatus = raw.requestStatus || raw.request_status || raw.status || ''
  const requestAssignees = Array.isArray(raw.request_assignees)
    ? raw.request_assignees.map((item) => {
        if (!item || typeof item !== 'object') return item
        const requestAssigneeStatus = item.requestAssigneeStatus || item.request_assignee_status || item.status || ''
        return {
          ...item,
          requestAssigneeStatus,
          request_assignee_status: item.request_assignee_status || requestAssigneeStatus,
        }
      })
    : raw.request_assignees

  return {
    ...raw,
    requestStatus,
    request_status: raw.request_status || requestStatus,
    request_assignees: requestAssignees,
  }
}

function normalizeResponseData(payload) {
  if (Array.isArray(payload?.data)) {
    return {
      ...payload,
      data: payload.data.map(normalizeRequestStatus),
    }
  }

  if (payload?.data && typeof payload.data === 'object') {
    return {
      ...payload,
      data: normalizeRequestStatus(payload.data),
    }
  }

  return payload
}

export async function getRequests(params = {}) {
  const normalizedParams = { ...params }

  if (normalizedParams.request_status && !normalizedParams.requestStatus) {
    normalizedParams.requestStatus = normalizedParams.request_status
  }

  if (normalizedParams['filters[request_status]'] && !normalizedParams['filters[requestStatus]']) {
    normalizedParams['filters[requestStatus]'] = normalizedParams['filters[request_status]']
  }

  if (normalizedParams['filters[request_status][$eq]'] && !normalizedParams['filters[requestStatus][$eq]']) {
    normalizedParams['filters[requestStatus][$eq]'] = normalizedParams['filters[request_status][$eq]']
  }

  const res = await api.get('/requests', { params: normalizedParams })
  return normalizeResponseData(res.data)
}

export async function getRequestById(id) {
  const res = await api.get(`/requests/${id}`, {
    params: {
      'populate[attachments]': '*',
      'populate[requester]': '*',
      'populate[request_category]': '*',
      'populate[request_tags]': '*',
      'populate[request_assignees][populate][user]': '*',
      'populate[request_messages][populate][author]': '*',
      'populate[request_messages][populate][attachments]': '*',
    },
  })
  return normalizeResponseData(res.data)
}

export async function createRequest(payload) {
  const res = await api.post('/requests', payload)
  return normalizeResponseData(res.data)
}

export async function updateRequest(id, payload) {
  const res = await api.put(`/requests/${id}`, payload)
  return normalizeResponseData(res.data)
}

export async function changeRequestStatus(id, status) {
  const res = await api.post(`/requests/${id}/status`, { requestStatus: status, status })
  return normalizeResponseData(res.data)
}

export async function getRequestCategories() {
  const res = await api.get('/request-categories')
  return res.data
}

export async function addAssignee(requestId, payload) {
  const res = await api.post(`/requests/${requestId}/assignees`, payload)
  return res.data
}

export async function removeAssignee(requestId, assigneeId) {
  const res = await api.delete(`/requests/${requestId}/assignees/${assigneeId}`)
  return res.data
}

export async function getMessages(requestId) {
  const res = await api.get(`/requests/${requestId}/messages`, {
    params: {
      sort: 'createdAt:asc',
      'filters[publishedAt][$notNull]': true,
    },
  })
  return res.data
}

export async function uploadFiles(files = []) {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))

  const res = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  const rows = Array.isArray(res?.data) ? res.data : []
  const fileIds = rows
    .map((item) => Number(item?.id))
    .filter((id) => Number.isInteger(id) && id > 0)

  return { fileIds, files: rows }
}

export async function createRequestMessage(requestId, payload) {
  const res = await api.post(`/requests/${requestId}/messages`, payload)
  return normalizeResponseData(res.data)
}

export async function closeRequest(requestId, payload) {
  const res = await api.post(`/requests/${requestId}/close`, payload)
  return normalizeResponseData(res.data)
}
