import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { FsStore } from '../../src/store/fs-store'
import type {
  AgentConfig,
  SubagentConfig,
  SkillConfig,
  HookConfig,
  RunLog,
} from '../../src/types'

describe('FsStore', () => {
  let tmpDir: string
  let store: FsStore

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-company-test-'))
    // 기본 디렉토리 구조 생성
    fs.mkdirSync(path.join(tmpDir, 'agents'), { recursive: true })
    fs.mkdirSync(path.join(tmpDir, 'subagents'), { recursive: true })
    fs.mkdirSync(path.join(tmpDir, 'skills'), { recursive: true })
    fs.mkdirSync(path.join(tmpDir, 'hooks'), { recursive: true })
    fs.mkdirSync(path.join(tmpDir, 'runs'), { recursive: true })
    fs.writeFileSync(
      path.join(tmpDir, 'config.json'),
      JSON.stringify({ version: '1.0.0' })
    )
    store = new FsStore(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('Agent CRUD', () => {
    it('createAgent → 디렉토리 + agent.json + prompt.md 생성 확인', () => {
      const config: AgentConfig = {
        name: 'developer',
        description: '개발자 에이전트',
        subagents: ['git-expert'],
        skills: ['deploy'],
        hooks: [],
      }

      store.createAgent(config)

      const agentDir = path.join(tmpDir, 'agents', 'developer')
      expect(fs.existsSync(agentDir)).toBe(true)
      expect(fs.existsSync(path.join(agentDir, 'agent.json'))).toBe(true)
      expect(fs.existsSync(path.join(agentDir, 'prompt.md'))).toBe(true)

      const savedConfig = JSON.parse(
        fs.readFileSync(path.join(agentDir, 'agent.json'), 'utf-8')
      )
      expect(savedConfig).toEqual(config)
    })

    it('getAgent → 생성한 agent를 정확히 읽어오는지', () => {
      const config: AgentConfig = {
        name: 'designer',
        description: '디자이너 에이전트',
        subagents: ['figma-expert'],
      }

      store.createAgent(config)
      const loaded = store.getAgent('designer')

      expect(loaded.name).toBe('designer')
      expect(loaded.description).toBe('디자이너 에이전트')
      expect(loaded.subagents).toEqual(['figma-expert'])
    })

    it('listAgents → 복수 agent 목록 반환', () => {
      store.createAgent({ name: 'agent1', description: 'Agent 1' })
      store.createAgent({ name: 'agent2', description: 'Agent 2' })
      store.createAgent({ name: 'agent3', description: 'Agent 3' })

      const agents = store.listAgents()

      expect(agents).toHaveLength(3)
      const names = agents.map((a) => a.name).sort()
      expect(names).toEqual(['agent1', 'agent2', 'agent3'])
    })

    it('removeAgent → 디렉토리 삭제 확인', () => {
      store.createAgent({ name: 'toremove', description: 'To Remove' })
      const agentDir = path.join(tmpDir, 'agents', 'toremove')
      expect(fs.existsSync(agentDir)).toBe(true)

      store.removeAgent('toremove')

      expect(fs.existsSync(agentDir)).toBe(false)
    })

    it('존재하지 않는 agent getAgent → 에러', () => {
      expect(() => store.getAgent('nonexistent')).toThrow(
        'Agent not found: nonexistent'
      )
    })

    it('updateAgent → 기존 agent 설정 업데이트', () => {
      store.createAgent({ name: 'updatable', description: 'Original' })

      store.updateAgent('updatable', {
        description: 'Updated',
        subagents: ['new-subagent'],
      })

      const updated = store.getAgent('updatable')
      expect(updated.name).toBe('updatable')
      expect(updated.description).toBe('Updated')
      expect(updated.subagents).toEqual(['new-subagent'])
    })
  })

  describe('공용 리소스 CRUD - Subagent', () => {
    it('createSubagent → .cc-company/subagents/ 에 .md 파일 생성', () => {
      const config: SubagentConfig = {
        name: 'git-expert',
        description: 'Git 전문가',
        prompt: 'You are a git expert.',
      }

      store.createSubagent(config)

      const filePath = path.join(tmpDir, 'subagents', 'git-expert.md')
      expect(fs.existsSync(filePath)).toBe(true)

      // frontmatter + body 형식 검증
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toContain('---')
      expect(content).toContain('name: git-expert')
      expect(content).toContain('description: Git 전문가')
      expect(content).toContain('You are a git expert.')
    })

    it('listSubagents → 전체 목록', () => {
      store.createSubagent({
        name: 'sub1',
        description: 'Subagent 1',
        prompt: 'prompt1',
      })
      store.createSubagent({
        name: 'sub2',
        description: 'Subagent 2',
        prompt: 'prompt2',
      })

      const subagents = store.listSubagents()

      expect(subagents).toHaveLength(2)
      const names = subagents.map((s) => s.name).sort()
      expect(names).toEqual(['sub1', 'sub2'])
    })

    it('removeSubagent → 파일 삭제', () => {
      store.createSubagent({
        name: 'tobedeleted',
        description: 'To be deleted',
        prompt: 'prompt',
      })
      const filePath = path.join(tmpDir, 'subagents', 'tobedeleted.md')
      expect(fs.existsSync(filePath)).toBe(true)

      store.removeSubagent('tobedeleted')

      expect(fs.existsSync(filePath)).toBe(false)
    })

    it('존재하지 않는 리소스 get → 에러', () => {
      expect(() => store.getSubagent('nonexistent')).toThrow(
        'Subagent not found: nonexistent'
      )
    })
  })

  describe('공용 리소스 CRUD - Skill', () => {
    it('createSkill → skills 디렉토리에 .md 파일 생성', () => {
      const config: SkillConfig = {
        name: 'deploy',
        description: '배포 스킬',
        prompt: 'You can deploy applications.',
      }

      store.createSkill(config)

      const filePath = path.join(tmpDir, 'skills', 'deploy.md')
      expect(fs.existsSync(filePath)).toBe(true)

      // frontmatter + body 형식 검증
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toContain('---')
      expect(content).toContain('name: deploy')
      expect(content).toContain('description: 배포 스킬')
      expect(content).toContain('You can deploy applications.')
    })

    it('listSkills → 전체 목록', () => {
      store.createSkill({
        name: 'skill1',
        description: 'Skill 1',
        prompt: 'prompt1',
      })
      store.createSkill({
        name: 'skill2',
        description: 'Skill 2',
        prompt: 'prompt2',
      })

      const skills = store.listSkills()
      expect(skills).toHaveLength(2)
    })

    it('removeSkill → 파일 삭제', () => {
      store.createSkill({
        name: 'tobedeleted',
        description: 'To be deleted',
        prompt: 'prompt',
      })

      store.removeSkill('tobedeleted')

      const filePath = path.join(tmpDir, 'skills', 'tobedeleted.md')
      expect(fs.existsSync(filePath)).toBe(false)
    })

    it('존재하지 않는 skill get → 에러', () => {
      expect(() => store.getSkill('nonexistent')).toThrow(
        'Skill not found: nonexistent'
      )
    })
  })

  describe('공용 리소스 CRUD - Hook', () => {
    it('createHook → hooks 디렉토리에 파일 생성', () => {
      const config: HookConfig = {
        name: 'pre-commit',
        description: 'Pre-commit 훅',
        config: { command: 'npm run lint' },
      }

      store.createHook(config)

      const filePath = path.join(tmpDir, 'hooks', 'pre-commit.json')
      expect(fs.existsSync(filePath)).toBe(true)
    })

    it('listHooks → 전체 목록', () => {
      store.createHook({
        name: 'hook1',
        description: 'Hook 1',
        config: {},
      })
      store.createHook({
        name: 'hook2',
        description: 'Hook 2',
        config: {},
      })

      const hooks = store.listHooks()
      expect(hooks).toHaveLength(2)
    })

    it('removeHook → 파일 삭제', () => {
      store.createHook({
        name: 'tobedeleted',
        description: 'To be deleted',
        config: {},
      })

      store.removeHook('tobedeleted')

      const filePath = path.join(tmpDir, 'hooks', 'tobedeleted.json')
      expect(fs.existsSync(filePath)).toBe(false)
    })

    it('존재하지 않는 hook get → 에러', () => {
      expect(() => store.getHook('nonexistent')).toThrow(
        'Hook not found: nonexistent'
      )
    })
  })

  describe('참조 해석', () => {
    it('agent.json의 subagents 이름 배열 → 실제 파일 내용으로 resolve', () => {
      // 공용 풀에 subagent 생성
      store.createSubagent({
        name: 'git-expert',
        description: 'Git 전문가',
        prompt: 'You are a git expert.',
      })
      store.createSubagent({
        name: 'code-reviewer',
        description: '코드 리뷰어',
        prompt: 'You review code.',
      })

      // agent 생성 (subagent 참조)
      store.createAgent({
        name: 'developer',
        description: '개발자',
        subagents: ['git-expert', 'code-reviewer'],
      })

      // 참조 해석
      const agent = store.getAgent('developer')
      const resolved = store.resolveSubagents(agent.subagents || [])

      expect(resolved).toHaveLength(2)
      expect(resolved[0].name).toBe('git-expert')
      expect(resolved[0].prompt).toBe('You are a git expert.')
      expect(resolved[1].name).toBe('code-reviewer')
    })

    it('참조된 리소스가 공용 풀에 없을 때 → 에러', () => {
      // agent에서 존재하지 않는 subagent 참조 시도
      store.createAgent({
        name: 'developer',
        description: '개발자',
        subagents: ['nonexistent-subagent'],
      })

      const agent = store.getAgent('developer')
      expect(() => store.resolveSubagents(agent.subagents || [])).toThrow(
        'Subagent not found: nonexistent-subagent'
      )
    })

    it('resolveSkills → skills 이름 배열을 실제 내용으로 resolve', () => {
      store.createSkill({
        name: 'deploy',
        description: '배포',
        prompt: 'You can deploy.',
      })

      const resolved = store.resolveSkills(['deploy'])
      expect(resolved).toHaveLength(1)
      expect(resolved[0].name).toBe('deploy')
    })

    it('resolveHooks → hooks 이름 배열을 실제 내용으로 resolve', () => {
      store.createHook({
        name: 'pre-commit',
        description: 'Pre-commit',
        config: { command: 'npm run lint' },
      })

      const resolved = store.resolveHooks(['pre-commit'])
      expect(resolved).toHaveLength(1)
      expect(resolved[0].name).toBe('pre-commit')
    })
  })

  describe('Run Logs', () => {
    it('saveRunLog → runs 디렉토리에 파일 생성', () => {
      const log: RunLog = {
        id: 'test-uuid',
        agent: 'developer',
        prompt: '버그 고쳐줘',
        startedAt: '2026-03-19T10:00:00Z',
        finishedAt: '2026-03-19T10:05:00Z',
        exitCode: 0,
        flags: ['--model', 'opus'],
        stdout: 'output',
        stderr: '',
      }

      store.saveRunLog(log)

      const files = fs.readdirSync(path.join(tmpDir, 'runs'))
      expect(files).toHaveLength(1)
      expect(files[0]).toContain('test-uuid')
    })

    it('getRunLogs → 전체 로그 반환 (최신순 정렬)', () => {
      const log1: RunLog = {
        id: 'uuid1',
        agent: 'developer',
        prompt: 'prompt1',
        startedAt: '2026-03-19T10:00:00Z',
        finishedAt: '2026-03-19T10:05:00Z',
        exitCode: 0,
        flags: [],
        stdout: '',
        stderr: '',
      }
      const log2: RunLog = {
        id: 'uuid2',
        agent: 'designer',
        prompt: 'prompt2',
        startedAt: '2026-03-19T11:00:00Z',
        finishedAt: '2026-03-19T11:05:00Z',
        exitCode: 1,
        flags: [],
        stdout: '',
        stderr: '',
      }

      store.saveRunLog(log1)
      store.saveRunLog(log2)

      const logs = store.getRunLogs()
      expect(logs).toHaveLength(2)
      // 최신순 정렬
      expect(logs[0].id).toBe('uuid2')
      expect(logs[1].id).toBe('uuid1')
    })

    it('getRunLogs with filter → 필터링된 결과 반환', () => {
      const log1: RunLog = {
        id: 'uuid1',
        agent: 'developer',
        prompt: 'prompt1',
        startedAt: '2026-03-19T10:00:00Z',
        finishedAt: '2026-03-19T10:05:00Z',
        exitCode: 0,
        flags: [],
        stdout: '',
        stderr: '',
      }
      const log2: RunLog = {
        id: 'uuid2',
        agent: 'designer',
        prompt: 'prompt2',
        startedAt: '2026-03-19T11:00:00Z',
        finishedAt: '2026-03-19T11:05:00Z',
        exitCode: 1,
        flags: [],
        stdout: '',
        stderr: '',
      }

      store.saveRunLog(log1)
      store.saveRunLog(log2)

      // agent 필터
      const developerLogs = store.getRunLogs({ agent: 'developer' })
      expect(developerLogs).toHaveLength(1)
      expect(developerLogs[0].agent).toBe('developer')

      // exitCode 필터
      const failedLogs = store.getRunLogs({ exitCode: 1 })
      expect(failedLogs).toHaveLength(1)
      expect(failedLogs[0].agent).toBe('designer')
    })
  })

  describe('Project Config', () => {
    it('getProjectConfig → config.json 읽기', () => {
      const config = store.getProjectConfig()
      expect(config.version).toBe('1.0.0')
    })

    it('config.json이 없으면 에러', () => {
      fs.unlinkSync(path.join(tmpDir, 'config.json'))
      expect(() => store.getProjectConfig()).toThrow('Project config not found')
    })
  })
})
