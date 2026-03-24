import { create } from 'zustand'

type ConnectionState = 'connecting' | 'connected' | 'disconnected'

interface ConnectionStore {
  state: ConnectionState
  setState: (state: ConnectionState) => void
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  state: 'connecting',
  setState: (state) => set({ state }),
}))
