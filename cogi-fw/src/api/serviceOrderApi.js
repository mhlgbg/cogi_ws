import api from "./api"

export async function getServiceOrders(params = {}) {
  const res = await api.get("/service-orders/list", { params })
  return res.data
}

export async function getServiceOrderById(id) {
  const res = await api.get(`/service-orders/${id}`)
  return res.data
}

export async function createServiceOrder(payload) {
  const res = await api.post("/service-orders", { data: payload })
  return res.data
}

export async function updateServiceOrder(id, payload) {
  const res = await api.put(`/service-orders/${id}`, { data: payload })
  return res.data
}

export async function getServiceOrderItemsByOrder(orderId) {
  const res = await api.get("/service-order-items", {
    params: {
      "pagination[page]": 1,
      "pagination[pageSize]": 500,
      "sort[0]": "sortOrder:asc",
      "sort[1]": "createdAt:asc",
      "filters[order][id][$eq]": orderId,
      "populate[serviceItem][fields][0]": "name",
      "populate[serviceItem][fields][1]": "code",
      "populate[attachments][fields][0]": "name",
      "populate[attachments][fields][1]": "url",
    },
  })
  return res.data
}

export async function createServiceOrderItem(payload) {
  const res = await api.post("/service-order-items", { data: payload })
  return res.data
}

export async function updateServiceOrderItem(id, payload) {
  const res = await api.put(`/service-order-items/${id}`, { data: payload })
  return res.data
}

export async function deleteServiceOrderItem(id) {
  const res = await api.delete(`/service-order-items/${id}`)
  return res.data
}

export async function getDepartmentsLookup() {
  const res = await api.get("/departments", {
    params: {
      "pagination[page]": 1,
      "pagination[pageSize]": 500,
      "sort[0]": "name:asc",
    },
  })
  return res.data
}

export async function getEmployeesLookup() {
  const res = await api.get("/employees", {
    params: {
      "pagination[page]": 1,
      "pagination[pageSize]": 500,
      "sort[0]": "fullName:asc",
      "populate[currentDepartment][fields][0]": "name",
    },
  })
  return res.data
}

export async function getCustomersLookup(params = {}) {
  try {
    const res = await api.get("/service-orders/lookups/customers", {
      params,
    })
    return res.data
  } catch {
    const keyword = String(params?.keyword || "").trim()
    const limit = Number(params?.limit) > 0 ? Number(params.limit) : 100

    const fallbackParams = {
      "pagination[page]": 1,
      "pagination[pageSize]": Math.min(limit, 500),
      "sort[0]": "isDefaultRetailGuest:desc",
      "sort[1]": "name:asc",
      "filters[isActive][$eq]": true,
    }

    if (keyword) {
      fallbackParams["filters[$or][0][name][$containsi]"] = keyword
      fallbackParams["filters[$or][1][phone][$containsi]"] = keyword
      fallbackParams["filters[$or][2][code][$containsi]"] = keyword
      fallbackParams["filters[$or][3][zalo][$containsi]"] = keyword
    }

    const fallback = await api.get("/customers", { params: fallbackParams })
    return fallback.data
  }
}

export async function getServiceItemsLookup(params = {}) {
  try {
    const res = await api.get("/service-orders/lookups/service-items", {
      params,
    })
    return res.data
  } catch {
    const keyword = String(params?.keyword || "").trim()
    const limit = Number(params?.limit) > 0 ? Number(params.limit) : 200
    const category = Number(params?.category)

    const fallbackParams = {
      "pagination[page]": 1,
      "pagination[pageSize]": Math.min(limit, 500),
      "sort[0]": "sortOrder:asc",
      "sort[1]": "name:asc",
      "filters[isActive][$eq]": true,
      "populate[category][fields][0]": "code",
      "populate[category][fields][1]": "name",
      "populate[category][fields][2]": "isActive",
    }

    if (Number.isInteger(category) && category > 0) {
      fallbackParams["filters[category][id][$eq]"] = category
      fallbackParams["filters[category][isActive][$eq]"] = true
    }

    if (keyword) {
      fallbackParams["filters[$or][0][name][$containsi]"] = keyword
      fallbackParams["filters[$or][1][code][$containsi]"] = keyword
    }

    const fallback = await api.get("/service-items", { params: fallbackParams })
    return fallback.data
  }
}

export async function uploadFiles(files = []) {
  const formData = new FormData()
  files.forEach((file) => formData.append("files", file))

  const res = await api.post("/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  })

  const rows = Array.isArray(res?.data) ? res.data : []
  const fileIds = rows
    .map((item) => Number(item?.id))
    .filter((id) => Number.isInteger(id) && id > 0)

  return { fileIds, files: rows }
}
