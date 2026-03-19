export interface AgentConfig {
  name: string
  description: string
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
  pluginDirPath?: string
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
