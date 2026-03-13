import axios from "./api"

// Nếu dùng Strapi local auth:
export async function loginApi(identifier, password) {
  try {
    const res = await axios.post("/auth/local", { identifier, password })
    return res.data // { jwt, user }
  } catch (err) {
    console.log("loginApi error status:", err?.response?.status)
    console.log("loginApi error data:", err?.response?.data)
    throw err
  }
}

export async function meApi() {
  try {
    const res = await axios.get("/me")
    return res.data
  } catch (error) {
    if (error?.response?.status !== 404) {
      throw error
    }

    const fallbackRes = await axios.get("/users/me")
    return fallbackRes.data
  }
}

export async function forgotPasswordApi(email) {
  const res = await axios.post("/auth/forgot-password", { email })
  return res.data
}

export async function getMyPermissionsApi() {
  const res = await axios.get("/users-permissions/permissions")
  return res.data
}

export async function iamMeApi() {
  const res = await axios.get("/iam/me")
  return res.data
}
