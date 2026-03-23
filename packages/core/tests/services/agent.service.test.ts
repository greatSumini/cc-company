import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { FsStore } from '../../src/store/fs-store'
import { AgentService } from '../../src/services/agent.service'

describe('AgentService', () => {
  let tmpDir: string
  let store: FsStore
  let agentService: AgentService

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentinc-test-'))
    // 기본 디렉토리 구조 생성
    fs.mkdirSync(path.join(tmpDir, 'agents'), { recursive: true })
    fs.mkdirSync(path.join(tmpDir, 'subagents'), { recursive: true })
    fs.mkdirSync(path.join(tmpDir, 'skills'), { recursive: true })
    fs.mkdirSync(path.join(tmpDir, 'hooks'), { recursive: true })
    fs.writeFileSync(
      path.join(tmpDir, 'config.json'),
      JSON.stringify({ version: '1.0.0' })
    )
    store = new FsStore(tmpDir)
    agentService = new AgentService(store)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('[assign]', () => {
    it('공용 풀에 있는 리소스 assign → agent.json에 이름 추가', () => {
      // agent 생성
      agentService.create('developer', '개발자 에이전트')

      // 공용 풀에 subagent 생성
      store.createSubagent({
        name: 'git-expert',
        description: 'Git 전문가',
        prompt: 'You are a git expert.',
      })

      // assign
      agentService.assignSubagent('developer', 'git-expert')

      // 확인
      const agent = agentService.show('developer')
      expect(agent.subagents).toContain('git-expert')
    })

    it('공용 풀에 없는 리소스 assign → 공용 풀에 생성 + agent.json에 추가', () => {
      // agent 생성
      agentService.create('developer', '개발자 에이전트')

      // 공용 풀에 없는 subagent assign
      agentService.assignSubagent('developer', 'code-reviewer')

      // agent에 할당 확인
      const agent = agentService.show('developer')
      expect(agent.subagents).toContain('code-reviewer')

      // 공용 풀에 생성 확인 (빈 템플릿)
      const subagent = store.getSubagent('code-reviewer')
      expect(subagent.name).toBe('code-reviewer')
      expect(subagent.description).toBe('')
      expect(subagent.prompt).toBe('')
    })

    it('이미 할당된 리소스 중복 assign → 무시 (에러 아님)', () => {
      // agent 생성
      agentService.create('developer', '개발자 에이전트')

      // 공용 풀에 subagent 생성
      store.createSubagent({
        name: 'git-expert',
        description: 'Git 전문가',
        prompt: 'You are a git expert.',
      })

      // 첫 번째 assign
      agentService.assignSubagent('developer', 'git-expert')

      // 중복 assign (에러 없어야 함)
      agentService.assignSubagent('developer', 'git-expert')

      // 확인 - 하나만 있어야 함
      const agent = agentService.show('developer')
      const count = agent.subagents?.filter((s) => s === 'git-expert').length
      expect(count).toBe(1)
    })

    it('skill assign - 공용 풀에 없으면 생성 후 할당', () => {
      agentService.create('developer', '개발자 에이전트')
      agentService.assignSkill('developer', 'deploy')

      const agent = agentService.show('developer')
      expect(agent.skills).toContain('deploy')

      const skill = store.getSkill('deploy')
      expect(skill.name).toBe('deploy')
    })

    it('hook assign - 공용 풀에 없으면 생성 후 할당', () => {
      agentService.create('developer', '개발자 에이전트')
      agentService.assignHook('developer', 'pre-commit')

      const agent = agentService.show('developer')
      expect(agent.hooks).toContain('pre-commit')

      const hook = store.getHook('pre-commit')
      expect(hook.name).toBe('pre-commit')
    })
  })

  describe('[unassign]', () => {
    it('할당된 리소스 unassign → agent.json에서 제거, 공용 풀은 유지', () => {
      // agent 생성 + subagent 생성 및 할당
      agentService.create('developer', '개발자 에이전트')
      store.createSubagent({
        name: 'git-expert',
        description: 'Git 전문가',
        prompt: 'You are a git expert.',
      })
      agentService.assignSubagent('developer', 'git-expert')

      // unassign
      agentService.unassignSubagent('developer', 'git-expert')

      // agent에서 제거 확인
      const agent = agentService.show('developer')
      expect(agent.subagents).not.toContain('git-expert')

      // 공용 풀에는 여전히 존재
      const subagent = store.getSubagent('git-expert')
      expect(subagent.name).toBe('git-expert')
    })

    it('할당되지 않은 리소스 unassign → 에러', () => {
      // agent 생성
      agentService.create('developer', '개발자 에이전트')

      // 할당되지 않은 리소스 unassign
      expect(() =>
        agentService.unassignSubagent('developer', 'nonexistent')
      ).toThrow("Subagent 'nonexistent' is not assigned to agent 'developer'")
    })

    it('skill unassign', () => {
      agentService.create('developer', '개발자 에이전트')
      store.createSkill({ name: 'deploy', description: '배포', prompt: 'deploy' })
      agentService.assignSkill('developer', 'deploy')
      agentService.unassignSkill('developer', 'deploy')

      const agent = agentService.show('developer')
      expect(agent.skills).not.toContain('deploy')
    })

    it('hook unassign', () => {
      agentService.create('developer', '개발자 에이전트')
      store.createHook({ name: 'pre-commit', description: 'hook', config: {} })
      agentService.assignHook('developer', 'pre-commit')
      agentService.unassignHook('developer', 'pre-commit')

      const agent = agentService.show('developer')
      expect(agent.hooks).not.toContain('pre-commit')
    })
  })

  describe('[remove]', () => {
    it('agent 삭제 시 공용 풀 리소스는 영향 없음', () => {
      // agent + subagent 생성 및 할당
      agentService.create('developer', '개발자 에이전트')
      store.createSubagent({
        name: 'git-expert',
        description: 'Git 전문가',
        prompt: 'You are a git expert.',
      })
      agentService.assignSubagent('developer', 'git-expert')

      // agent 삭제
      agentService.remove('developer')

      // 공용 풀의 subagent는 여전히 존재
      const subagent = store.getSubagent('git-expert')
      expect(subagent.name).toBe('git-expert')

      // agent는 삭제됨
      expect(() => agentService.show('developer')).toThrow('Agent not found')
    })
  })

  describe('[basic operations]', () => {
    it('create and list agents', () => {
      agentService.create('developer', '개발자')
      agentService.create('designer', '디자이너')

      const agents = agentService.list()
      expect(agents).toHaveLength(2)
    })

    it('show agent', () => {
      agentService.create('developer', '개발자')
      const agent = agentService.show('developer')
      expect(agent.name).toBe('developer')
      expect(agent.description).toBe('개발자')
    })
  })
})
