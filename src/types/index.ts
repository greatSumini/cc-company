export interface AgentConfig {
  name: string
  description: string
  gh_user?: string // gh CLI에 등록된 GitHub 계정명
  can_delegate?: boolean // true이면 다른 agent에게 ticket 위임(생성) 가능
  subagents?: string[]
  skills?: string[]
  hooks?: string[]
}

export interface SubagentConfig {
  name: string
  description: string
  prompt: string
  // Claude Code 호환 optional 필드
  model?: string
  tools?: string
  disallowedTools?: string
  maxTurns?: number
  permissionMode?: string
}

export interface SkillConfig {
  name: string
  description: string
  prompt: string
  resources?: string[] // 보조 파일 상대경로 목록 (SKILL.md 기준)
  // Claude Code 호환 optional 필드
  model?: string
  allowedTools?: string
  context?: string
  agent?: string
  userInvocable?: boolean
  disableModelInvocation?: boolean
  argumentHint?: string
}

export interface HookConfig {
  name: string
  description: string
  config: Record<string, unknown>
}

export interface RunLog {
  id: string
  agent: string
  prompt: string | null
  mode: 'interactive' | 'print'
  startedAt: string
  finishedAt: string
  exitCode: number
  flags: string[]
  stdout: string
  stderr: string
}

export interface ProjectConfig {
  version: string
}

export interface RunLogFilter {
  agent?: string
  fromDate?: string
  toDate?: string
  exitCode?: number
}

export interface FlagBuilderInput {
  agent: AgentConfig
  promptFilePath: string
  subagents?: SubagentConfig[]
  settingsFilePath?: string
  mcpConfigFilePath?: string
  addDirPath?: string // --add-dir 경로 (skills 임시 디렉토리)
  prompt?: string
  passthroughFlags: string[]
}

export interface RunLogger {
  log(
    agent: string,
    prompt: string | null,
    mode: 'interactive' | 'print',
    flags: string[],
    result: { exitCode: number; stdout: string; stderr: string },
    startedAt: Date,
    finishedAt: Date
  ): void
}

// ============================================
// Ticket System Types
// ============================================

export type TicketStatus = 'blocked' | 'ready' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
export type TicketType = 'task' | 'cc_review'
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface Comment {
  id: string
  author: string
  content: string
  createdAt: string
}

export interface TicketResult {
  exitCode: number
  logPath: string
}

export interface Ticket {
  id: string
  title: string
  prompt: string
  type: TicketType
  parentTicketId?: string
  ccReviewTicketIds?: string[]
  assignee: string
  priority: TicketPriority
  status: TicketStatus
  createdBy: string
  createdAt: string
  startedAt?: string
  completedAt?: string
  cancelledAt?: string
  result?: TicketResult
  comments: Comment[]
  version: number
}

export interface CreateTicketInput {
  title: string
  prompt: string
  assignee: string
  cc?: string[]
  priority?: TicketPriority
  createdBy: string
}

export interface UpdateTicketInput {
  status?: TicketStatus
  priority?: TicketPriority
  startedAt?: string
  completedAt?: string
  cancelledAt?: string
  result?: TicketResult
  ccReviewTicketIds?: string[]
  expectedVersion: number
}

export interface TicketFilter {
  status?: TicketStatus
  assignee?: string
  type?: TicketType
}

export interface CreateCommentInput {
  author: string
  content: string
}

// ============================================
// Agent Status Types
// ============================================

export type AgentState = 'offline' | 'idle' | 'working'

export interface AgentStatus {
  name: string
  state: AgentState
  currentTicketId?: string
  processStartedAt?: string
  lastHeartbeatAt?: string
}

// ============================================
// Ticket Server Config
// ============================================

export interface TicketServerConfig {
  port: number
  pollingIntervalMs: number
  idleTimeoutMs: number
  heartbeatTimeoutMs: number
}

export interface GlobalConfig {
  version: string
  ticketServer?: TicketServerConfig
}
