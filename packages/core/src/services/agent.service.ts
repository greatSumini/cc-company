import type { IStore } from '../store/store.js'
import type { AgentConfig } from '../types/index.js'

export class AgentService {
  constructor(private store: IStore) {}

  create(name: string, description: string): void {
    this.store.createAgent({ name, description })
  }

  list(): AgentConfig[] {
    return this.store.listAgents()
  }

  show(name: string): AgentConfig {
    const agent = this.store.getAgent(name)
    return agent
  }

  remove(name: string): void {
    this.store.removeAgent(name)
  }

  assignSubagent(agentName: string, subagentName: string): void {
    const agent = this.store.getAgent(agentName)

    // 이미 할당되어 있으면 무시
    if (agent.subagents?.includes(subagentName)) {
      return
    }

    // 공용 풀에 없으면 빈 템플릿으로 생성
    try {
      this.store.getSubagent(subagentName)
    } catch {
      this.store.createSubagent({
        name: subagentName,
        description: '',
        prompt: '',
      })
    }

    // agent.json에 이름 추가
    const subagents = [...(agent.subagents || []), subagentName]
    this.store.updateAgent(agentName, { subagents })
  }

  assignSkill(agentName: string, skillName: string): void {
    const agent = this.store.getAgent(agentName)

    // 이미 할당되어 있으면 무시
    if (agent.skills?.includes(skillName)) {
      return
    }

    // 공용 풀에 없으면 빈 템플릿으로 생성
    try {
      this.store.getSkill(skillName)
    } catch {
      this.store.createSkill({
        name: skillName,
        description: '',
        prompt: '',
      })
    }

    // agent.json에 이름 추가
    const skills = [...(agent.skills || []), skillName]
    this.store.updateAgent(agentName, { skills })
  }

  assignHook(agentName: string, hookName: string): void {
    const agent = this.store.getAgent(agentName)

    // 이미 할당되어 있으면 무시
    if (agent.hooks?.includes(hookName)) {
      return
    }

    // 공용 풀에 없으면 빈 템플릿으로 생성
    try {
      this.store.getHook(hookName)
    } catch {
      this.store.createHook({
        name: hookName,
        description: '',
        config: {},
      })
    }

    // agent.json에 이름 추가
    const hooks = [...(agent.hooks || []), hookName]
    this.store.updateAgent(agentName, { hooks })
  }

  unassignSubagent(agentName: string, subagentName: string): void {
    const agent = this.store.getAgent(agentName)

    if (!agent.subagents?.includes(subagentName)) {
      throw new Error(`Subagent '${subagentName}' is not assigned to agent '${agentName}'`)
    }

    const subagents = agent.subagents.filter((name) => name !== subagentName)
    this.store.updateAgent(agentName, { subagents })
  }

  unassignSkill(agentName: string, skillName: string): void {
    const agent = this.store.getAgent(agentName)

    if (!agent.skills?.includes(skillName)) {
      throw new Error(`Skill '${skillName}' is not assigned to agent '${agentName}'`)
    }

    const skills = agent.skills.filter((name) => name !== skillName)
    this.store.updateAgent(agentName, { skills })
  }

  unassignHook(agentName: string, hookName: string): void {
    const agent = this.store.getAgent(agentName)

    if (!agent.hooks?.includes(hookName)) {
      throw new Error(`Hook '${hookName}' is not assigned to agent '${agentName}'`)
    }

    const hooks = agent.hooks.filter((name) => name !== hookName)
    this.store.updateAgent(agentName, { hooks })
  }
}
