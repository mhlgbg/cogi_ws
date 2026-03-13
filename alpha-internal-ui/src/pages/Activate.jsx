import React, { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import api from "../api/api"

export default function Activate() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const token = (searchParams.get("token") || "").trim()

  const [status, setStatus] = useState("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    let isCancelled = false

    async function activateAccount() {
      if (!token) {
        setStatus("error")
        setMessage("Invalid activation link")
        return
      }

      setStatus("loading")
      setMessage("")

      try {
        const res = await api.post("/auth/activate", { token })
        const resetPasswordToken = (res?.data?.resetPasswordToken || "").trim()

        if (!isCancelled) {
          if (!resetPasswordToken) {
            setStatus("error")
            setMessage("Kích hoạt thành công nhưng thiếu resetPasswordToken. Vui lòng liên hệ quản trị viên.")
            return
          }

          setStatus("success")
          setMessage("Tài khoản đã được kích hoạt thành công")
          navigate(`/set-password?token=${encodeURIComponent(resetPasswordToken)}`)
        }
      } catch (err) {
        if (!isCancelled) {
          const apiMessage =
            err?.response?.data?.error?.message ||
            err?.response?.data?.message ||
            err?.message ||
            "Activation failed"

          setStatus("error")
          setMessage(apiMessage)
        }
      }
    }

    activateAccount()

    return () => {
      isCancelled = true
    }
  }, [token, navigate])

  return (
    <div style={{ maxWidth: 560, margin: "60px auto", padding: "0 16px" }}>
      {status === "loading" ? <p>Loading...</p> : null}
      {status === "success" ? <p>{message}</p> : null}
      {status === "error" ? <p>{message}</p> : null}

      <button type="button" onClick={() => navigate("/login")}>
        Đi đến đăng nhập
      </button>
    </div>
  )
}
