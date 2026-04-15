/**
 * lib/api.js
 *
 * Central Axios instance for all API calls.
 * - Base URL from VITE_API_URL env var (falls back to localhost:5000 for dev)
 * - withCredentials: true  → sends the HttpOnly cookie automatically
 * - Authorization header   → also sends the JWT from localStorage for clients
 *   that don't auto-send the cookie (e.g. mobile, Postman)
 */

import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  withCredentials: true, // send the HttpOnly cookie on every request
})

// Attach JWT from localStorage on every outgoing request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api
