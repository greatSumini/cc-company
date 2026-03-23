import { create } from 'zustand'

interface AgentState {
  statuses: Record<string, 'idle' | 'working'>
  updateStatus: (agent: string, state: 'idle' | 'working') => void
  setStatuses: (statuses: Record<string, 'idle' | 'working'>) => void
}

export const useAgentStore = create<AgentState>((set) => ({
  statuses: {},
  updateStatus: (agent, state) =>
    set((s) => ({
      statuses: { ...s.statuses, [agent]: state },
    })),
  setStatuses: (statuses) => set({ statuses }),
}))
