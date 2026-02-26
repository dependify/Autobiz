const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

class ApiClient {
  private baseUrl: string
  private token: string | null = null

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  setToken(token: string | null) {
    this.token = token
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('dependify_token', token)
      } else {
        localStorage.removeItem('dependify_token')
      }
    }
  }

  getToken(): string | null {
    if (this.token) return this.token
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('dependify_token')
    }
    return this.token
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken()

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }))
      throw new Error((error as { error?: string }).error ?? `HTTP ${response.status}`)
    }

    return response.json() as Promise<T>
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path)
  }

  async post<T>(path: string, data: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async patch<T>(path: string, data: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' })
  }
}

export const api = new ApiClient(API_URL)

// Auth
export const authApi = {
  register: (data: { email: string; password: string; name: string; businessName: string; market: string }) =>
    api.post<{ token: string; user: Record<string, unknown>; tenantId: string }>('/api/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post<{ token: string; user: Record<string, unknown> }>('/api/auth/login', data),
  logout: () => api.post('/api/auth/logout', {}),
  me: () => api.get<{ user: Record<string, unknown> }>('/api/auth/me'),
}

// CRM
export const crmApi = {
  listContacts: (params?: Record<string, unknown>) =>
    api.get<{ data: unknown[]; pagination: Record<string, unknown> }>(`/api/crm/contacts?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),
  getContact: (id: string) => api.get(`/api/crm/contacts/${id}`),
  createContact: (data: unknown) => api.post('/api/crm/contacts', data),
  updateContact: (id: string, data: unknown) => api.patch(`/api/crm/contacts/${id}`, data),
  deleteContact: (id: string) => api.delete(`/api/crm/contacts/${id}`),
  addInteraction: (contactId: string, data: unknown) => api.post(`/api/crm/contacts/${contactId}/interactions`, data),
}
