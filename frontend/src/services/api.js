/**
 * API service - wraps axios for all backend calls.
 * Reads the base URL from VITE_API_URL (injected by generate-env.sh / .env.local).
 * The proxy routes:  http://localhost:3001/api/team-service/{resource}
 */

import axios from 'axios'

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api/team-service'

const client = axios.create({ baseURL: BASE })

// Attach JWT on every request
client.interceptors.request.use(cfg => {
  const token = localStorage.getItem('acme_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// Global 401 handler – clear token and reload
client.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('acme_token')
      localStorage.removeItem('acme_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────

export const login = (username, password) =>
  client.post('/auth/login', { username, password }).then(r => r.data)

export const register = (data) =>
  client.post('/auth/register', data).then(r => r.data)

export const getMe = () =>
  client.get('/auth/me').then(r => r.data)

export const seedUsers = () =>
  client.post('/auth/seed').then(r => r.data)

// ── Teams ─────────────────────────────────────────────────────────────────────

export const getTeams = (params = {}) =>
  client.get('/teams', { params }).then(r => r.data)

export const getTeam = id =>
  client.get(`/teams/${id}`).then(r => r.data)

export const createTeam = data =>
  client.post('/teams', data).then(r => r.data)

export const updateTeam = (id, data) =>
  client.put(`/teams/${id}`, data).then(r => r.data)

export const deleteTeam = id =>
  client.delete(`/teams/${id}`)

// ── Members ───────────────────────────────────────────────────────────────────

export const getMembers = (params = {}) =>
  client.get('/members', { params }).then(r => r.data)

export const getMember = id =>
  client.get(`/members/${id}`).then(r => r.data)

export const createMember = data =>
  client.post('/members', data).then(r => r.data)

export const updateMember = (id, data) =>
  client.put(`/members/${id}`, data).then(r => r.data)

export const deleteMember = id =>
  client.delete(`/members/${id}`)

// ── Achievements ──────────────────────────────────────────────────────────────

export const getAchievements = (params = {}) =>
  client.get('/achievements', { params }).then(r => r.data)

export const getAchievement = id =>
  client.get(`/achievements/${id}`).then(r => r.data)

export const createAchievement = data =>
  client.post('/achievements', data).then(r => r.data)

export const updateAchievement = (id, data) =>
  client.put(`/achievements/${id}`, data).then(r => r.data)

export const deleteAchievement = id =>
  client.delete(`/achievements/${id}`)

// ── Metadata ──────────────────────────────────────────────────────────────────

export const getMetadata = (params = {}) =>
  client.get('/metadata', { params }).then(r => r.data)

export const createMetadataEntry = data =>
  client.post('/metadata', data).then(r => r.data)

export const updateMetadataEntry = (id, data) =>
  client.put(`/metadata/${id}`, data).then(r => r.data)

export const deleteMetadataEntry = id =>
  client.delete(`/metadata/${id}`)

// ── Stats ─────────────────────────────────────────────────────────────────────

export const getStats = () =>
  client.get('/stats').then(r => r.data)
