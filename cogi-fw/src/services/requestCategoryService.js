import api from "../api/api"

export async function getRequestCategories({ page = 1, pageSize = 10, q } = {}) {
  const params = {
    sort: ["name:asc"],
    pagination: { page, pageSize },
    populate: {
      parent: { fields: ["name", "slug"] },
    },
  }

  if (q) {
    params.filters = {
      $or: [
        { name: { $containsi: q } },
        { slug: { $containsi: q } },
        { description: { $containsi: q } },
      ],
    }
  }

  const res = await api.get("/request-categories", { params })
  return res.data
}

export async function createRequestCategory(payload) {
  const res = await api.post("/request-categories", { data: payload })
  return res.data
}

export async function updateRequestCategory(id, payload) {
  const res = await api.put(`/request-categories/${id}`, { data: payload })
  return res.data
}

export async function deleteRequestCategory(id) {
  const res = await api.delete(`/request-categories/${id}`)
  return res.data
}
