import { create } from 'zustand'

type AgentStatusState = 'offline' | 'idle' | 'working'

interface AgentState {
  statuses: Record<string, AgentStatusState>
  updateStatus: (agent: string, state: AgentStatusState) => void
  setStatuses: (statuses: Record<string, AgentStatusState>) => void
}

export const useAgentStore = create<AgentState>((set) => ({
  statuses: {},
  updateStatus: (agent, state) =>
    set((s) => ({
      statuses: { ...s.statuses, [agent]: state },
    })),
  setStatuses: (statuses) => set({ statuses }),
}))
