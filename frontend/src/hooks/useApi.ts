import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Return error for handling by callers - don't throw globally
    return Promise.reject(error)
  }
)

export async function get<T>(path: string): Promise<T> {
  const response = await apiClient.get<T>(path)
  return response.data
}

export async function post<T>(path: string, data?: unknown): Promise<T> {
  const response = await apiClient.post<T>(path, data)
  return response.data
}

export async function put<T>(path: string, data?: unknown): Promise<T> {
  const response = await apiClient.put<T>(path, data)
  return response.data
}

export async function del<T>(path: string): Promise<T> {
  const response = await apiClient.delete<T>(path)
  return response.data
}

export default apiClient
