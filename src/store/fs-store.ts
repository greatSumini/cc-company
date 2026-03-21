import * as fs from 'fs'
import * as path from 'path'
import type { IStore } from './store.js'
import type {
  AgentConfig,
  SubagentConfig,
  SkillConfig,
  HookConfig,
  RunLog,
  RunLogFilter,
  ProjectConfig,
} from '../types/index.js'
import {
  parseSubagentMd,
  parseSkillMd,
  serializeSubagentMd,
  serializeSkillMd,
} from '../utils/frontmatter.js'

export class FsStore implements IStore {
  private readonly rootPath: string

  constructor(rootPath: string) {
    this.rootPath = rootPath
  }

  // Project config
  getProjectConfig(): ProjectConfig {
    const configPath = path.join(this.rootPath, 'config.json')
    if (!fs.existsSync(configPath)) {
      throw new Error(`Project config not found: ${configPath}`)
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  }

  // Agent
  getAgent(name: string): AgentConfig {
    const agentDir = path.join(this.rootPath, 'agents', name)
    const agentJsonPath = path.join(agentDir, 'agent.json')

    if (!fs.existsSync(agentJsonPath)) {
      throw new Error(`Agent not found: ${name}`)
    }

    return JSON.parse(fs.readFileSync(agentJsonPath, 'utf-8'))
  }

  listAgents(): AgentConfig[] {
    const agentsDir = path.join(this.rootPath, 'agents')
    if (!fs.existsSync(agentsDir)) {
      return []
    }

    const entries = fs.readdirSync(agentsDir, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => this.getAgent(entry.name))
  }

  createAgent(config: AgentConfig): void {
    const agentDir = path.join(this.rootPath, 'agents', config.name)

    if (fs.existsSync(agentDir)) {
      throw new Error(`Agent already exists: ${config.name}`)
    }

    fs.mkdirSync(agentDir, { recursive: true })
    fs.writeFileSync(
      path.join(agentDir, 'agent.json'),
      JSON.stringify(config, null, 2)
    )
    fs.writeFileSync(path.join(agentDir, 'prompt.md'), '')
  }

  removeAgent(name: string): void {
    const agentDir = path.join(this.rootPath, 'agents', name)

    if (!fs.existsSync(agentDir)) {
      throw new Error(`Agent not found: ${name}`)
    }

    fs.rmSync(agentDir, { recursive: true })
  }

  updateAgent(name: string, config: Partial<AgentConfig>): void {
    const existing = this.getAgent(name)
    const updated = { ...existing, ...config, name } // name은 변경 불가
    const agentJsonPath = path.join(this.rootPath, 'agents', name, 'agent.json')
    fs.writeFileSync(agentJsonPath, JSON.stringify(updated, null, 2))
  }

  // Subagents (공용 풀)
  getSubagent(name: string): SubagentConfig {
    const filePath = path.join(this.rootPath, 'subagents', `${name}.md`)

    if (!fs.existsSync(filePath)) {
      throw new Error(`Subagent not found: ${name}`)
    }

    return parseSubagentMd(fs.readFileSync(filePath, 'utf-8'))
  }

  listSubagents(): SubagentConfig[] {
    const dir = path.join(this.rootPath, 'subagents')
    if (!fs.existsSync(dir)) {
      return []
    }

    return fs
      .readdirSync(dir)
      .filter((file) => file.endsWith('.md'))
      .map((file) => {
        const name = file.replace('.md', '')
        return this.getSubagent(name)
      })
  }

  createSubagent(config: SubagentConfig): void {
    const dir = path.join(this.rootPath, 'subagents')
    const filePath = path.join(dir, `${config.name}.md`)

    if (fs.existsSync(filePath)) {
      throw new Error(`Subagent already exists: ${config.name}`)
    }

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(filePath, serializeSubagentMd(config))
  }

  removeSubagent(name: string): void {
    const filePath = path.join(this.rootPath, 'subagents', `${name}.md`)

    if (!fs.existsSync(filePath)) {
      throw new Error(`Subagent not found: ${name}`)
    }

    fs.unlinkSync(filePath)
  }

  // Skills (공용 풀) - 디렉토리 기반

  // [MIGRATION v0.3] 단일 .md → 디렉토리 전환. 안정화 후 삭제 예정
  private migrateSkillIfNeeded(name: string): void {
    const legacyPath = path.join(this.rootPath, 'skills', `${name}.md`)
    const dirPath = path.join(this.rootPath, 'skills', name)

    if (fs.existsSync(legacyPath) && !fs.existsSync(dirPath)) {
      // 단일 .md → 디렉토리로 변환
      const content = fs.readFileSync(legacyPath, 'utf-8')
      fs.mkdirSync(dirPath, { recursive: true })
      fs.writeFileSync(path.join(dirPath, 'SKILL.md'), content)
      // 관례적 서브디렉토리 생성
      fs.mkdirSync(path.join(dirPath, 'scripts'), { recursive: true })
      fs.mkdirSync(path.join(dirPath, 'references'), { recursive: true })
      fs.mkdirSync(path.join(dirPath, 'assets'), { recursive: true })
      // 원본 삭제
      fs.unlinkSync(legacyPath)
      console.log(`Migrated skill '${name}' from .md to directory format.`)
    }
  }

  // [MIGRATION v0.3] listSkills 전 단일 .md 파일 전부 마이그레이션
  private migrateAllLegacySkills(): void {
    const skillsDir = path.join(this.rootPath, 'skills')
    if (!fs.existsSync(skillsDir)) {
      return
    }

    const entries = fs.readdirSync(skillsDir)
    for (const entry of entries) {
      if (entry.endsWith('.md')) {
        const name = entry.replace('.md', '')
        this.migrateSkillIfNeeded(name)
      }
    }
  }

  getSkill(name: string): SkillConfig {
    // 마이그레이션 체크
    this.migrateSkillIfNeeded(name)

    const dirPath = path.join(this.rootPath, 'skills', name)
    const skillMdPath = path.join(dirPath, 'SKILL.md')

    if (!fs.existsSync(skillMdPath)) {
      throw new Error(`Skill not found: ${name}`)
    }

    return parseSkillMd(fs.readFileSync(skillMdPath, 'utf-8'))
  }

  listSkills(): SkillConfig[] {
    const dir = path.join(this.rootPath, 'skills')
    if (!fs.existsSync(dir)) {
      return []
    }

    // 먼저 레거시 .md 파일 전부 마이그레이션
    this.migrateAllLegacySkills()

    const entries = fs.readdirSync(dir, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => this.getSkill(entry.name))
  }

  createSkill(config: SkillConfig): void {
    const skillsDir = path.join(this.rootPath, 'skills')
    const dirPath = path.join(skillsDir, config.name)

    if (fs.existsSync(dirPath)) {
      throw new Error(`Skill already exists: ${config.name}`)
    }

    // 레거시 .md 파일도 체크
    const legacyPath = path.join(skillsDir, `${config.name}.md`)
    if (fs.existsSync(legacyPath)) {
      throw new Error(`Skill already exists: ${config.name}`)
    }

    // 디렉토리 생성
    fs.mkdirSync(dirPath, { recursive: true })
    // SKILL.md 작성
    fs.writeFileSync(path.join(dirPath, 'SKILL.md'), serializeSkillMd(config))
    // 관례적 서브디렉토리 생성
    fs.mkdirSync(path.join(dirPath, 'scripts'), { recursive: true })
    fs.mkdirSync(path.join(dirPath, 'references'), { recursive: true })
    fs.mkdirSync(path.join(dirPath, 'assets'), { recursive: true })
  }

  removeSkill(name: string): void {
    const dirPath = path.join(this.rootPath, 'skills', name)

    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      throw new Error(`Skill not found: ${name}`)
    }

    fs.rmSync(dirPath, { recursive: true })
  }

  // Hooks (공용 풀)
  getHook(name: string): HookConfig {
    const filePath = path.join(this.rootPath, 'hooks', `${name}.json`)

    if (!fs.existsSync(filePath)) {
      throw new Error(`Hook not found: ${name}`)
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  }

  listHooks(): HookConfig[] {
    const dir = path.join(this.rootPath, 'hooks')
    if (!fs.existsSync(dir)) {
      return []
    }

    return fs
      .readdirSync(dir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => {
        const name = file.replace('.json', '')
        return this.getHook(name)
      })
  }

  createHook(config: HookConfig): void {
    const dir = path.join(this.rootPath, 'hooks')
    const filePath = path.join(dir, `${config.name}.json`)

    if (fs.existsSync(filePath)) {
      throw new Error(`Hook already exists: ${config.name}`)
    }

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(filePath, JSON.stringify(config, null, 2))
  }

  removeHook(name: string): void {
    const filePath = path.join(this.rootPath, 'hooks', `${name}.json`)

    if (!fs.existsSync(filePath)) {
      throw new Error(`Hook not found: ${name}`)
    }

    fs.unlinkSync(filePath)
  }

  // Run logs
  saveRunLog(log: RunLog): void {
    const dir = path.join(this.rootPath, 'runs')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const timestamp = log.startedAt.replace(/[:.]/g, '')
    const filename = `${timestamp}-${log.id}.json`
    const filePath = path.join(dir, filename)

    fs.writeFileSync(filePath, JSON.stringify(log, null, 2))
  }

  getRunLogs(filter?: RunLogFilter): RunLog[] {
    const dir = path.join(this.rootPath, 'runs')
    if (!fs.existsSync(dir)) {
      return []
    }

    const logs = fs
      .readdirSync(dir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8')
        return JSON.parse(content) as RunLog
      })
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))

    if (!filter) {
      return logs
    }

    return logs.filter((log) => {
      if (filter.agent && log.agent !== filter.agent) return false
      if (filter.exitCode !== undefined && log.exitCode !== filter.exitCode)
        return false
      if (filter.fromDate && log.startedAt < filter.fromDate) return false
      if (filter.toDate && log.startedAt > filter.toDate) return false
      return true
    })
  }

  // Skill file operations
  addSkillFile(skillName: string, filePath: string, content: string): void {
    const skillDir = path.join(this.rootPath, 'skills', skillName)
    if (!fs.existsSync(skillDir) || !fs.statSync(skillDir).isDirectory()) {
      throw new Error(`Skill not found: ${skillName}`)
    }

    const targetPath = path.join(skillDir, filePath)
    // 부모 디렉토리 생성
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    // 파일 쓰기
    fs.writeFileSync(targetPath, content)

    // SKILL.md resources에 등록
    const skillMdPath = path.join(skillDir, 'SKILL.md')
    const skillConfig = parseSkillMd(fs.readFileSync(skillMdPath, 'utf-8'))
    const resources = skillConfig.resources ?? []
    if (!resources.includes(filePath)) {
      resources.push(filePath)
      skillConfig.resources = resources
      fs.writeFileSync(skillMdPath, serializeSkillMd(skillConfig))
    }
  }

  editSkillFile(skillName: string, filePath: string, content: string): void {
    const skillDir = path.join(this.rootPath, 'skills', skillName)
    if (!fs.existsSync(skillDir) || !fs.statSync(skillDir).isDirectory()) {
      throw new Error(`Skill not found: ${skillName}`)
    }

    const targetPath = path.join(skillDir, filePath)
    if (!fs.existsSync(targetPath)) {
      throw new Error(`File not found: ${filePath} in skill '${skillName}'`)
    }

    fs.writeFileSync(targetPath, content)
  }

  removeSkillFile(skillName: string, filePath: string): void {
    const skillDir = path.join(this.rootPath, 'skills', skillName)
    if (!fs.existsSync(skillDir) || !fs.statSync(skillDir).isDirectory()) {
      throw new Error(`Skill not found: ${skillName}`)
    }

    const targetPath = path.join(skillDir, filePath)
    if (!fs.existsSync(targetPath)) {
      throw new Error(`File not found: ${filePath} in skill '${skillName}'`)
    }

    // 파일 삭제
    fs.unlinkSync(targetPath)

    // SKILL.md resources에서 제거
    const skillMdPath = path.join(skillDir, 'SKILL.md')
    const skillConfig = parseSkillMd(fs.readFileSync(skillMdPath, 'utf-8'))
    if (skillConfig.resources) {
      skillConfig.resources = skillConfig.resources.filter((r) => r !== filePath)
      fs.writeFileSync(skillMdPath, serializeSkillMd(skillConfig))
    }
  }

  getSkillFile(skillName: string, filePath: string): string {
    const skillDir = path.join(this.rootPath, 'skills', skillName)
    if (!fs.existsSync(skillDir) || !fs.statSync(skillDir).isDirectory()) {
      throw new Error(`Skill not found: ${skillName}`)
    }

    const targetPath = path.join(skillDir, filePath)
    if (!fs.existsSync(targetPath)) {
      throw new Error(`File not found: ${filePath} in skill '${skillName}'`)
    }

    return fs.readFileSync(targetPath, 'utf-8')
  }

  getSkillDir(skillName: string): string {
    const dirPath = path.join(this.rootPath, 'skills', skillName)
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      throw new Error(`Skill not found: ${skillName}`)
    }
    return dirPath
  }

  // 참조 해석
  resolveSubagents(names: string[]): SubagentConfig[] {
    return names.map((name) => this.getSubagent(name))
  }

  resolveSkills(names: string[]): SkillConfig[] {
    return names.map((name) => this.getSkill(name))
  }

  resolveHooks(names: string[]): HookConfig[] {
    return names.map((name) => this.getHook(name))
  }
}
