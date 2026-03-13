import api from "../api/api"

// NOTE:
// - baseURL đã gồm /api trong .env
// - không hardcode localhost
// - Strapi payload dạng { data: ... }

export async function getRequests({ page = 1, pageSize = 10, status, q } = {}) {
  const params = {
    populate: "*",
    sort: ["createdAt:desc"],
    pagination: { page, pageSize },
  }

  // filters
  const filters = {}
  if (status) filters.status = { $eq: status }

  // nếu có search text (tuỳ field thực tế)
  if (q) {
    filters.$or = [
      { title: { $containsi: q } },
      { description: { $containsi: q } },
    ]
  }

  if (Object.keys(filters).length > 0) params.filters = filters

  const res = await api.get("/requests", { params })
  return res.data // { data, meta }
}

export async function getRequest(id) {
  const res = await api.get(`/requests/${id}`, { params: { populate: "*" } })
  return res.data
}

export async function createRequest(payload) {
  const res = await api.post("/requests", { data: payload })
  return res.data
}

export async function updateRequest(id, payload) {
  const res = await api.put(`/requests/${id}`, { data: payload })
  return res.data
}

export async function deleteRequest(id) {
  const res = await api.delete(`/requests/${id}`)
  return res.data
}
