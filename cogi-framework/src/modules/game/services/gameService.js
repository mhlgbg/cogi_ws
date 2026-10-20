import api from '../../../api/axios'

function unwrapData(response, fallback) {
  if (response?.data?.data !== undefined) return response.data.data
  return fallback
}

export function getGameApiMessage(error, fallback = 'Yêu cầu không thành công.') {
  const data = error?.response?.data
  const message = data?.error?.message || data?.message || error?.message
  return String(message || fallback).trim() || fallback
}

export async function getGameManagementDashboard() {
  const response = await api.get('/game-management/dashboard')
  return unwrapData(response, {
    summary: {
      totalGames: 0,
      upcomingGames: 0,
      runningGames: 0,
      endedGames: 0,
      totalParticipants: 0,
    },
    gameTypes: [],
    games: [],
    placeholders: {},
  })
}

export async function getTenantGameTypes() {
  const response = await api.get('/game-management/game-types')
  return Array.isArray(response?.data?.data) ? response.data.data : []
}

export async function updateTenantGameTypeEnablement(gameTypeId, isEnabled) {
  const response = await api.patch(`/game-management/game-types/${gameTypeId}/enablement`, {
    isEnabled,
  })
  return unwrapData(response, null)
}

export async function createGame(payload) {
  const response = await api.post('/game-management/games', {
    data: payload,
  })
  return unwrapData(response, null)
}

export async function updateGame(gameId, payload) {
  const response = await api.put(`/game-management/games/${gameId}`, {
    data: payload,
  })
  return unwrapData(response, null)
}

export async function publishGame(gameId) {
  const response = await api.post(`/game-management/games/${gameId}/publish`)
  return unwrapData(response, null)
}

export async function unpublishGame(gameId) {
  const response = await api.post(`/game-management/games/${gameId}/unpublish`)
  return unwrapData(response, null)
}

export async function getGameDetail(gameId) {
  const response = await api.get(`/game-management/games/${gameId}`)
  return unwrapData(response, null)
}

export async function updateGameRules(gameId, rules) {
  const response = await api.put(`/game-management/games/${gameId}/rules`, {
    data: { rules },
  })
  return unwrapData(response, null)
}

export async function createResetChallenge(gameId) {
  const response = await api.post(`/game-management/games/${gameId}/reset-challenge`)
  return unwrapData(response, null)
}

export async function resetGameProgress(gameId, payload) {
  const response = await api.post(`/game-management/games/${gameId}/reset`, {
    data: payload,
  })
  return unwrapData(response, null)
}

export async function getGameCenterData() {
  const response = await api.get('/game-center/games')
  return unwrapData(response, {
    summary: {
      upcomingGames: 0,
      runningGames: 0,
      endedGames: 0,
      registeredGames: 0,
    },
    games: [],
  })
}

export async function getGameCenterDetail(gameId) {
  const response = await api.get(`/game-center/games/${gameId}`)
  return unwrapData(response, null)
}

export async function registerForGame(gameId) {
  const response = await api.post(`/game-center/games/${gameId}/register`)
  return unwrapData(response, null)
}

export async function signalDailyActive(signalSource = 'app') {
  const response = await api.post('/game-center/activity-signal', {
    signalSource,
  }, {
    suppressErrorLogging: true,
  })
  return unwrapData(response, [])
}
