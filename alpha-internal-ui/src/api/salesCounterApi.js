import api from "./api"

export async function getSalesCounterContext() {
  const res = await api.get("/service-orders/counter-context")
  return res.data
}

export async function quickCreateCounterCustomer(payload) {
  const res = await api.post("/service-orders/lookups/customers/quick-create", {
    data: payload,
  })
  return res.data
}
