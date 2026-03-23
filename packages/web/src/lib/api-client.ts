const API_BASE = '/api'

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`)
  }

  return response.json()
}

export const api = {
  tickets: {
    list: (params?: { status?: string; assignee?: string }) => {
      const searchParams = new URLSearchParams()
      if (params?.status) searchParams.set('status', params.status)
      if (params?.assignee) searchParams.set('assignee', params.assignee)
      const query = searchParams.toString()
      return fetchAPI<unknown[]>(`/tickets${query ? `?${query}` : ''}`)
    },
    get: (id: string) => fetchAPI<unknown>(`/tickets/${id}`),
  },
  agents: {
    list: () => fetchAPI<unknown[]>('/agents'),
    status: () => fetchAPI<unknown[]>('/agents/status'),
  },
}
