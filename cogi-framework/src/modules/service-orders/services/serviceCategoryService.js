import api from '../../../api/axios'

export async function getServiceCategories({ page = 1, pageSize = 10, q = '', isActive = '' } = {}) {
  const params = {
    'pagination[page]': page,
    'pagination[pageSize]': pageSize,
    'sort[0]': 'sortOrder:asc',
    'sort[1]': 'name:asc',
  }

  const keyword = String(q || '').trim()
  if (keyword) {
    params['filters[$or][0][name][$containsi]'] = keyword
    params['filters[$or][1][code][$containsi]'] = keyword
    params['filters[$or][2][description][$containsi]'] = keyword
    params.q = keyword
  }

  if (isActive === true || isActive === false) {
    params['filters[isActive][$eq]'] = isActive
  } else if (String(isActive) === 'true' || String(isActive) === 'false') {
    params['filters[isActive][$eq]'] = String(isActive) === 'true'
  }

  const res = await api.get('/service-categories', { params })
  return res.data
}

export async function createServiceCategory(payload) {
  const res = await api.post('/service-categories', { data: payload })
  return res.data
}

export async function updateServiceCategory(id, payload) {
  const res = await api.put(`/service-categories/${id}`, { data: payload })
  return res.data
}

export async function deleteServiceCategory(id) {
  const res = await api.delete(`/service-categories/${id}`)
  return res.data
}