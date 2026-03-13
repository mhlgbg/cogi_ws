import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CContainer,
  CRow,
  CSpinner,
} from "@coreui/react"
import axios from "../../api/api"
import { useAuth } from "../../contexts/AuthContext"

const DASHBOARD_CARD_STYLE = {
  cursor: "pointer",
  transition: "transform .15s ease, box-shadow .15s ease",
}

const DASHBOARD_CARD_HOVER_STYLE = {
  transform: "translateY(-2px)",
  boxShadow: "0 0.5rem 1rem rgba(0,0,0,.12)",
}

function toNumberOrNull(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null
}

function extractCount(payload) {
  if (typeof payload === "number") return payload
  if (typeof payload?.count === "number") return payload.count
  if (typeof payload?.total === "number") return payload.total
  if (typeof payload?.data === "number") return payload.data
  if (typeof payload?.data?.count === "number") return payload.data.count
  if (typeof payload?.data?.total === "number") return payload.data.total
  if (typeof payload?.meta?.pagination?.total === "number") return payload.meta.pagination.total
  return null
}

function extractTotalFromListPayload(payload) {
  const total = payload?.meta?.pagination?.total
  return typeof total === "number" ? total : null
}

async function tryCountRequest(params) {
  const res = await axios.get("/requests/count", { params })
  return extractCount(res?.data)
}

async function tryCountUsers() {
  try {
    const res = await axios.get("/users/count")
    const count = extractCount(res?.data)
    if (count !== null) return count
  } catch {
    // fallback below
  }

  const res = await axios.get("/users", {
    params: {
      "pagination[page]": 1,
      "pagination[pageSize]": 1,
      page: 1,
      pageSize: 1,
    },
  })

  const total = extractTotalFromListPayload(res?.data)
  if (total !== null) return total

  if (Array.isArray(res?.data)) return res.data.length
  if (Array.isArray(res?.data?.data)) return res.data.data.length

  return 0
}

async function tryCountRequestsByList(params) {
  const res = await axios.get("/requests", {
    params: {
      "pagination[page]": 1,
      "pagination[pageSize]": 1,
      page: 1,
      pageSize: 1,
      ...params,
    },
  })

  const total = extractTotalFromListPayload(res?.data)
  if (total !== null) return total

  return Array.isArray(res?.data?.data) ? res.data.data.length : 0
}

async function resolveRequestCount({ meId, scopeKind, withPending = false }) {
  const scopeCandidatesByKind = {
    related: ["related", "RELEVANT"],
    created: ["created", "MINE"],
    assigned: ["assigned", "ASSIGNED"],
  }

  const statusCandidates = withPending ? ["pending", "WAITING"] : [undefined]

  for (const scopeValue of scopeCandidatesByKind[scopeKind] || []) {
    for (const status of statusCandidates) {
      try {
        const count = await tryCountRequest({ scope: scopeValue, status })
        if (count !== null) return count
      } catch {
        // continue to fallback
      }
    }
  }

  const listParamCandidates = []

  if (scopeKind === "related") {
    listParamCandidates.push({ scope: "related" })
    listParamCandidates.push({ scope: "RELEVANT" })
  }

  if (scopeKind === "created") {
    listParamCandidates.push({ scope: "created" })
    listParamCandidates.push({ scope: "MINE" })
    if (meId) {
      listParamCandidates.push({ "filters[requester][id][$eq]": meId })
      listParamCandidates.push({ "filters[createdBy][id][$eq]": meId })
    }
  }

  if (scopeKind === "assigned") {
    listParamCandidates.push({ scope: "assigned" })
    listParamCandidates.push({ scope: "ASSIGNED" })
    if (meId) {
      listParamCandidates.push({ "filters[assignees][id][$eq]": meId })
      listParamCandidates.push({ "filters[request_assignees][user][id][$eq]": meId })
    }
  }

  if (withPending) {
    for (const status of ["pending", "WAITING"]) {
      for (const candidate of listParamCandidates) {
        try {
          const count = await tryCountRequestsByList({ ...candidate, status, "filters[request_status][$eq]": status })
          if (count !== null) return count
        } catch {
          // keep trying
        }
      }
    }
    return 0
  }

  for (const candidate of listParamCandidates) {
    try {
      const count = await tryCountRequestsByList(candidate)
      if (count !== null) return count
    } catch {
      // keep trying
    }
  }

  return 0
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { me } = useAuth()

  const [summary, setSummary] = useState({
    relatedToMeTotal: 0,
    createdByMeTotal: 0,
    assignedToMeTotal: 0,
    pendingTotal: 0,
    usersTotal: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [hoveredCard, setHoveredCard] = useState("")

  const fullName = useMemo(() => {
    return me?.fullName || me?.fullname || me?.username || me?.email || "bạn"
  }, [me])

  const loadSummary = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      try {
        const summaryRes = await axios.get("/dashboard/summary")
        const payload = summaryRes?.data || {}

        setSummary({
          relatedToMeTotal: toNumberOrNull(payload?.relatedToMeTotal) ?? 0,
          createdByMeTotal: toNumberOrNull(payload?.createdByMeTotal) ?? 0,
          assignedToMeTotal: toNumberOrNull(payload?.assignedToMeTotal) ?? 0,
          pendingTotal: toNumberOrNull(payload?.pendingTotal) ?? 0,
          usersTotal: toNumberOrNull(payload?.usersTotal) ?? 0,
        })

        return
      } catch {
        // fallback request-by-request
      }

      const meId = toNumberOrNull(me?.id)
      const [relatedToMeTotal, createdByMeTotal, assignedToMeTotal, pendingTotal, usersTotal] = await Promise.all([
        resolveRequestCount({ meId, scopeKind: "related" }),
        resolveRequestCount({ meId, scopeKind: "created" }),
        resolveRequestCount({ meId, scopeKind: "assigned" }),
        resolveRequestCount({ meId, scopeKind: "related", withPending: true }),
        tryCountUsers(),
      ])

      setSummary({
        relatedToMeTotal,
        createdByMeTotal,
        assignedToMeTotal,
        pendingTotal,
        usersTotal,
      })
    } catch (e) {
      setError(e?.response?.data?.error?.message || e?.message || "Không thể tải dữ liệu dashboard")
    } finally {
      setLoading(false)
    }
  }, [me?.id])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  const cards = [
    {
      key: "related",
      label: "Tổng request liên quan tôi",
      value: summary.relatedToMeTotal,
      to: "/requests?scope=related",
      color: "info",
    },
    {
      key: "created",
      label: "Request tôi tạo",
      value: summary.createdByMeTotal,
      to: "/requests?scope=created",
      color: "primary",
    },
    {
      key: "assigned",
      label: "Request tôi được giao",
      value: summary.assignedToMeTotal,
      to: "/requests?scope=assigned",
      color: "warning",
    },
    {
      key: "pending",
      label: "Đang chờ xử lý",
      value: summary.pendingTotal,
      to: "/requests?scope=related&status=pending",
      color: "secondary",
    },
  ]

  return (
    <CContainer fluid>
      <CRow className="g-3 mb-2">
        <CCol xs={12} lg={8}>
          <CCard className="ai-card h-100">
            <CCardBody>
              <h4 className="mb-2">Xin chào, {fullName}</h4>
              <div className="text-body-secondary">
                Hôm nay bạn có <strong>{summary.pendingTotal}</strong> request đang chờ xử lý.
              </div>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol xs={12} lg={4}>
          <CCard className="ai-card h-100">
            <CCardBody className="d-flex flex-column justify-content-center">
              <div className="text-body-secondary mb-1">Users trong hệ thống</div>
              <div className="d-flex align-items-center gap-2">
                <h3 className="mb-0">{summary.usersTotal}</h3>
                <CBadge color="light" textColor="dark">
                  users
                </CBadge>
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {error ? (
        <CAlert color="danger" className="mb-3">
          {error}
        </CAlert>
      ) : null}

      {loading ? (
        <CCard className="ai-card mb-3">
          <CCardBody className="d-flex align-items-center gap-2 py-4">
            <CSpinner size="sm" />
            <span>Đang tải dữ liệu dashboard...</span>
          </CCardBody>
        </CCard>
      ) : (
        <CRow className="g-3 mb-3">
          {cards.map((card) => (
            <CCol key={card.key} xs={12} sm={6} xl={3}>
              <CCard
                className="ai-card h-100"
                style={{
                  ...DASHBOARD_CARD_STYLE,
                  ...(hoveredCard === card.key ? DASHBOARD_CARD_HOVER_STYLE : {}),
                }}
                onMouseEnter={() => setHoveredCard(card.key)}
                onMouseLeave={() => setHoveredCard("")}
                onClick={() => navigate(card.to)}
              >
                <CCardBody>
                  <div className="text-body-secondary mb-1">{card.label}</div>
                  <h2 className="mb-0">{card.value}</h2>
                  <CBadge color={card.color} className="mt-2">
                    Xem chi tiết
                  </CBadge>
                </CCardBody>
              </CCard>
            </CCol>
          ))}
        </CRow>
      )}

      <CCard className="ai-card">
        <CCardBody className="d-flex flex-wrap gap-2">
          <CButton color="primary" onClick={() => navigate("/requests/new")}>
            Tạo mới request
          </CButton>
          <CButton color="secondary" variant="outline" onClick={() => navigate("/requests")}>
            Quản lý request
          </CButton>
          <CButton color="light" variant="outline" onClick={loadSummary} disabled={loading}>
            Tải lại số liệu
          </CButton>
        </CCardBody>
      </CCard>
    </CContainer>
  )
}
