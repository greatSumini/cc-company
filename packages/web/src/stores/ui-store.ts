import { create } from 'zustand'

interface UIState {
  selectedTicketId: string | null
  agentFilter: string | null
  setSelectedTicketId: (id: string | null) => void
  setAgentFilter: (agent: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  selectedTicketId: null,
  agentFilter: null,
  setSelectedTicketId: (id) => set({ selectedTicketId: id }),
  setAgentFilter: (agent) => set({ agentFilter: agent }),
}))
