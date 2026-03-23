import * as fs from 'fs'
import * as path from 'path'
import type { AgentStatus, AgentState } from '../types/index.js'

export interface IAgentStatusStore {
  get(name: string): Promise<AgentStatus | null>
  getAll(): Promise<Record<string, AgentStatus>>
  updateState(name: string, state: AgentState, currentTicketId?: string): Promise<void>
  updateHeartbeat(name: string): Promise<void>
  remove(name: string): Promise<void>
}

export class AgentStatusStore implements IAgentStatusStore {
  constructor(
    private basePath: string,
    private heartbeatTimeoutMs: number = 30000
  ) {}

  private get statusPath(): string {
    return path.join(this.basePath, '.agentinc', 'status', 'agents.json')
  }

  private ensureStatusDir(): void {
    const dir = path.dirname(this.statusPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  private readStatuses(): Record<string, AgentStatus> {
    if (!fs.existsSync(this.statusPath)) {
      return {}
    }
    return JSON.parse(fs.readFileSync(this.statusPath, 'utf-8'))
  }

  private writeStatuses(statuses: Record<string, AgentStatus>): void {
    this.ensureStatusDir()
    fs.writeFileSync(this.statusPath, JSON.stringify(statuses, null, 2))
  }

  private applyOfflineCheck(status: AgentStatus): AgentStatus {
    if (!status.lastHeartbeatAt) {
      return status
    }

    const lastHeartbeat = new Date(status.lastHeartbeatAt).getTime()
    const now = Date.now()

    if (now - lastHeartbeat > this.heartbeatTimeoutMs) {
      return { ...status, state: 'offline' }
    }

    return status
  }

  async get(name: string): Promise<AgentStatus | null> {
    const statuses = this.readStatuses()
    const status = statuses[name]
    if (!status) {
      return null
    }
    return this.applyOfflineCheck(status)
  }

  async getAll(): Promise<Record<string, AgentStatus>> {
    const statuses = this.readStatuses()
    const result: Record<string, AgentStatus> = {}

    for (const [name, status] of Object.entries(statuses)) {
      result[name] = this.applyOfflineCheck(status)
    }

    return result
  }

  async updateState(
    name: string,
    state: AgentState,
    currentTicketId?: string
  ): Promise<void> {
    const statuses = this.readStatuses()
    const existing = statuses[name]

    statuses[name] = {
      name,
      state,
      currentTicketId,
      processStartedAt: existing?.processStartedAt ?? new Date().toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
    }

    this.writeStatuses(statuses)
  }

  async updateHeartbeat(name: string): Promise<void> {
    const statuses = this.readStatuses()
    const existing = statuses[name]

    if (!existing) {
      // agent가 없으면 idle 상태로 등록
      statuses[name] = {
        name,
        state: 'idle',
        processStartedAt: new Date().toISOString(),
        lastHeartbeatAt: new Date().toISOString(),
      }
    } else {
      statuses[name] = {
        ...existing,
        lastHeartbeatAt: new Date().toISOString(),
      }
    }

    this.writeStatuses(statuses)
  }

  async remove(name: string): Promise<void> {
    const statuses = this.readStatuses()
    delete statuses[name]
    this.writeStatuses(statuses)
  }
}
