import api from "./api"

export async function getPaymentTransactions(params = {}) {
  const res = await api.get("/payment-transactions/list", { params })
  return res.data
}

export async function createPaymentTransaction(payload) {
  const res = await api.post("/payment-transactions", { data: payload })
  return res.data
}
