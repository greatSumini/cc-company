import type {
  AgentConfig,
  SubagentConfig,
  SkillConfig,
  HookConfig,
  RunLog,
  RunLogFilter,
  ProjectConfig,
  GlobalConfig,
} from '../types/index.js'

export interface IStore {
  // Global config
  getGlobalConfig(): GlobalConfig
  updateGlobalConfig(updates: Partial<GlobalConfig>): void

  // Project config
  getProjectConfig(): ProjectConfig

  // Agent
  getAgent(name: string): AgentConfig
  listAgents(): AgentConfig[]
  createAgent(config: AgentConfig): void
  removeAgent(name: string): void
  updateAgent(name: string, config: Partial<AgentConfig>): void

  // Subagents (공용 풀)
  getSubagent(name: string): SubagentConfig
  listSubagents(): SubagentConfig[]
  createSubagent(config: SubagentConfig): void
  removeSubagent(name: string): void

  // Skills (공용 풀)
  getSkill(name: string): SkillConfig
  listSkills(): SkillConfig[]
  createSkill(config: SkillConfig): void
  removeSkill(name: string): void

  // Hooks (공용 풀)
  getHook(name: string): HookConfig
  listHooks(): HookConfig[]
  createHook(config: HookConfig): void
  removeHook(name: string): void

  // Run logs
  saveRunLog(log: RunLog): void
  getRunLogs(filter?: RunLogFilter): RunLog[]

  // Skill file operations
  addSkillFile(skillName: string, filePath: string, content: string): void
  editSkillFile(skillName: string, filePath: string, content: string): void
  removeSkillFile(skillName: string, filePath: string): void
  getSkillFile(skillName: string, filePath: string): string
  getSkillDir(skillName: string): string

  // 참조 해석
  resolveSubagents(names: string[]): SubagentConfig[]
  resolveSkills(names: string[]): SkillConfig[]
  resolveHooks(names: string[]): HookConfig[]
}
