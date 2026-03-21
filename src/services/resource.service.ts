import * as fs from 'fs'
import * as path from 'path'
import type { IStore } from '../store/store.js'
import type { SubagentConfig, SkillConfig, HookConfig } from '../types/index.js'

export interface ShowSkillResult {
  config: SkillConfig
  files: string[]
  warnings: string[]
}

export class ResourceService {
  constructor(private store: IStore) {}

  // Subagents
  createSubagent(name: string, description: string, prompt: string): void {
    this.store.createSubagent({ name, description, prompt })
  }

  listSubagents(): SubagentConfig[] {
    return this.store.listSubagents()
  }

  removeSubagent(name: string): void {
    // 할당된 agent가 있는지 확인
    const agents = this.store.listAgents()
    const assignedAgents = agents.filter((agent) =>
      agent.subagents?.includes(name)
    )

    if (assignedAgents.length > 0) {
      const agentNames = assignedAgents.map((a) => a.name).join(', ')
      console.warn(
        `Warning: Subagent '${name}' is assigned to agents: ${agentNames}. Removing anyway.`
      )
    }

    this.store.removeSubagent(name)
  }

  // Skills
  createSkill(name: string, description: string, prompt: string): void {
    this.store.createSkill({ name, description, prompt })
  }

  listSkills(): SkillConfig[] {
    return this.store.listSkills()
  }

  removeSkill(name: string): void {
    // 할당된 agent가 있는지 확인
    const agents = this.store.listAgents()
    const assignedAgents = agents.filter((agent) =>
      agent.skills?.includes(name)
    )

    if (assignedAgents.length > 0) {
      const agentNames = assignedAgents.map((a) => a.name).join(', ')
      console.warn(
        `Warning: Skill '${name}' is assigned to agents: ${agentNames}. Removing anyway.`
      )
    }

    this.store.removeSkill(name)
  }

  addSkillFile(skillName: string, filePath: string, content: string): void {
    this.store.addSkillFile(skillName, filePath, content)
  }

  editSkillFile(skillName: string, filePath: string, content: string): void {
    this.store.editSkillFile(skillName, filePath, content)
  }

  removeSkillFile(skillName: string, filePath: string): void {
    this.store.removeSkillFile(skillName, filePath)
  }

  showSkill(skillName: string): ShowSkillResult {
    const config = this.store.getSkill(skillName)
    const skillDir = this.store.getSkillDir(skillName)
    const files = this.collectSkillFiles(skillDir)
    const warnings: string[] = []

    const resources = config.resources ?? []

    // resources에 등록됐지만 실제 파일 없음
    for (const resource of resources) {
      if (!files.includes(resource)) {
        const warning = `⚠ skill "${skillName}": resources에 등록됐지만 파일 없음 — ${resource}`
        console.warn(warning)
        warnings.push(warning)
      }
    }

    // 파일 존재하지만 resources에 미등록
    for (const file of files) {
      if (!resources.includes(file)) {
        const warning = `⚠ skill "${skillName}": 파일 존재하지만 resources에 미등록 — ${file}`
        console.warn(warning)
        warnings.push(warning)
      }
    }

    return { config, files, warnings }
  }

  private collectSkillFiles(skillDir: string, subPath: string = ''): string[] {
    const files: string[] = []
    const currentDir = subPath ? path.join(skillDir, subPath) : skillDir

    if (!fs.existsSync(currentDir)) {
      return files
    }

    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const relativePath = subPath ? path.join(subPath, entry.name) : entry.name

      if (entry.isDirectory()) {
        // 재귀 탐색
        files.push(...this.collectSkillFiles(skillDir, relativePath))
      } else if (entry.isFile()) {
        // SKILL.md 제외
        if (entry.name !== 'SKILL.md') {
          files.push(relativePath)
        }
      }
    }

    return files
  }

  // Hooks
  createHook(name: string, description: string, config: Record<string, unknown>): void {
    this.store.createHook({ name, description, config })
  }

  listHooks(): HookConfig[] {
    return this.store.listHooks()
  }

  removeHook(name: string): void {
    // 할당된 agent가 있는지 확인
    const agents = this.store.listAgents()
    const assignedAgents = agents.filter((agent) =>
      agent.hooks?.includes(name)
    )

    if (assignedAgents.length > 0) {
      const agentNames = assignedAgents.map((a) => a.name).join(', ')
      console.warn(
        `Warning: Hook '${name}' is assigned to agents: ${agentNames}. Removing anyway.`
      )
    }

    this.store.removeHook(name)
  }
}
