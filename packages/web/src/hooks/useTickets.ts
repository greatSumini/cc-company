import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { Ticket } from '@/types/ticket'

interface UseTicketsOptions {
  status?: string
  assignee?: string
}

export function useTickets(options: UseTicketsOptions = {}) {
  return useQuery<Ticket[]>({
    queryKey: ['tickets', options],
    queryFn: () => api.tickets.list(options) as Promise<Ticket[]>,
    // SSE로 실시간 업데이트하므로 polling 불필요
    refetchOnWindowFocus: false,
  })
}

export function useTicket(id: string | null) {
  return useQuery<Ticket>({
    queryKey: ['ticket', id],
    queryFn: () => api.tickets.get(id!) as Promise<Ticket>,
    enabled: !!id,
  })
}
