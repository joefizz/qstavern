import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
})

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('qs_token')
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401, clear token and redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('qs_token')
      window.location.reload()
    }
    return Promise.reject(error)
  }
)
