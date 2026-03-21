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

  describe('[Skill 디렉토리 CRUD]', () => {
    it('createSkill → skills/{name}/ 디렉토리 + SKILL.md + 서브디렉토리 스캐폴딩 생성', () => {
      const config: SkillConfig = {
        name: 'deploy',
        description: '배포 스킬',
        prompt: 'You can deploy applications.',
      }

      store.createSkill(config)

      const skillDir = path.join(tmpDir, 'skills', 'deploy')
      expect(fs.existsSync(skillDir)).toBe(true)
      expect(fs.statSync(skillDir).isDirectory()).toBe(true)

      // SKILL.md 존재 확인
      const skillMdPath = path.join(skillDir, 'SKILL.md')
      expect(fs.existsSync(skillMdPath)).toBe(true)

      // frontmatter + body 형식 검증
      const content = fs.readFileSync(skillMdPath, 'utf-8')
      expect(content).toContain('---')
      expect(content).toContain('name: deploy')
      expect(content).toContain('description: 배포 스킬')
      expect(content).toContain('You can deploy applications.')

      // 관례적 서브디렉토리 존재 확인
      expect(fs.existsSync(path.join(skillDir, 'scripts'))).toBe(true)
      expect(fs.existsSync(path.join(skillDir, 'references'))).toBe(true)
      expect(fs.existsSync(path.join(skillDir, 'assets'))).toBe(true)
    })

    it('getSkill → 디렉토리 내 SKILL.md 파싱하여 SkillConfig 반환', () => {
      const config: SkillConfig = {
        name: 'deploy',
        description: '배포 스킬',
        prompt: 'You can deploy applications.',
        resources: ['scripts/run.sh'],
      }

      store.createSkill(config)
      const loaded = store.getSkill('deploy')

      expect(loaded.name).toBe('deploy')
      expect(loaded.description).toBe('배포 스킬')
      expect(loaded.prompt).toBe('You can deploy applications.')
    })

    it('listSkills → 디렉토리 순회로 전체 목록 반환', () => {
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
      const names = skills.map((s) => s.name).sort()
      expect(names).toEqual(['skill1', 'skill2'])
    })

    it('removeSkill → 디렉토리 통째로 삭제', () => {
      store.createSkill({
        name: 'tobedeleted',
        description: 'To be deleted',
        prompt: 'prompt',
      })

      const skillDir = path.join(tmpDir, 'skills', 'tobedeleted')
      expect(fs.existsSync(skillDir)).toBe(true)

      store.removeSkill('tobedeleted')

      expect(fs.existsSync(skillDir)).toBe(false)
    })

    it('존재하지 않는 skill getSkill → 에러', () => {
      expect(() => store.getSkill('nonexistent')).toThrow(
        'Skill not found: nonexistent'
      )
    })
  })

  describe('[Skill 파일 CRUD]', () => {
    beforeEach(() => {
      // 테스트용 skill 생성
      store.createSkill({
        name: 'deploy',
        description: '배포 스킬',
        prompt: 'You can deploy applications.',
      })
    })

    it('addSkillFile → 파일 생성 + SKILL.md resources에 자동 등록', () => {
      store.addSkillFile('deploy', 'scripts/run.sh', '#!/bin/bash\necho "deploy"')

      // 파일 생성 확인
      const filePath = path.join(tmpDir, 'skills', 'deploy', 'scripts', 'run.sh')
      expect(fs.existsSync(filePath)).toBe(true)
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('#!/bin/bash\necho "deploy"')

      // resources에 등록 확인
      const skill = store.getSkill('deploy')
      expect(skill.resources).toContain('scripts/run.sh')
    })

    it('addSkillFile 중복 호출 → resources에 중복 등록 안됨', () => {
      store.addSkillFile('deploy', 'scripts/run.sh', 'content1')
      store.addSkillFile('deploy', 'scripts/run.sh', 'content2') // 덮어쓰기

      const skill = store.getSkill('deploy')
      const runShCount = skill.resources?.filter((r) => r === 'scripts/run.sh').length ?? 0
      expect(runShCount).toBe(1)
    })

    it('editSkillFile 존재하지 않는 파일 → 에러', () => {
      expect(() => store.editSkillFile('deploy', 'scripts/nonexistent.sh', 'content')).toThrow(
        "File not found: scripts/nonexistent.sh in skill 'deploy'"
      )
    })

    it('editSkillFile → 파일 내용 업데이트', () => {
      store.addSkillFile('deploy', 'scripts/run.sh', 'original')
      store.editSkillFile('deploy', 'scripts/run.sh', 'updated')

      const content = store.getSkillFile('deploy', 'scripts/run.sh')
      expect(content).toBe('updated')
    })

    it('removeSkillFile → 파일 삭제 + resources에서 자동 제거', () => {
      store.addSkillFile('deploy', 'scripts/run.sh', 'content')
      expect(store.getSkill('deploy').resources).toContain('scripts/run.sh')

      store.removeSkillFile('deploy', 'scripts/run.sh')

      // 파일 삭제 확인
      const filePath = path.join(tmpDir, 'skills', 'deploy', 'scripts', 'run.sh')
      expect(fs.existsSync(filePath)).toBe(false)

      // resources에서 제거 확인 (빈 배열이면 undefined가 됨)
      const skill = store.getSkill('deploy')
      const hasRunSh = (skill.resources ?? []).includes('scripts/run.sh')
      expect(hasRunSh).toBe(false)
    })

    it('removeSkillFile 존재하지 않는 파일 → 에러', () => {
      expect(() => store.removeSkillFile('deploy', 'scripts/nonexistent.sh')).toThrow(
        "File not found: scripts/nonexistent.sh in skill 'deploy'"
      )
    })

    it('getSkillDir → skill 디렉토리 경로 반환', () => {
      const dirPath = store.getSkillDir('deploy')
      expect(dirPath).toBe(path.join(tmpDir, 'skills', 'deploy'))
    })

    it('getSkillDir 존재하지 않는 skill → 에러', () => {
      expect(() => store.getSkillDir('nonexistent')).toThrow(
        'Skill not found: nonexistent'
      )
    })
  })

  describe('[마이그레이션]', () => {
    it('skills/ 내 단일 .md 파일 → getSkill 시 디렉토리로 자동 변환 + 원본 제거', () => {
      // 레거시 형식으로 skill 파일 직접 생성
      const legacyPath = path.join(tmpDir, 'skills', 'legacy-skill.md')
      const legacyContent = `---
name: legacy-skill
description: 레거시 스킬
---

Legacy skill prompt.`
      fs.writeFileSync(legacyPath, legacyContent)

      // getSkill 호출 시 마이그레이션 발생
      const skill = store.getSkill('legacy-skill')

      expect(skill.name).toBe('legacy-skill')
      expect(skill.description).toBe('레거시 스킬')
      expect(skill.prompt).toBe('Legacy skill prompt.')

      // 레거시 파일 삭제 확인
      expect(fs.existsSync(legacyPath)).toBe(false)

      // 디렉토리 형식으로 변환 확인
      const dirPath = path.join(tmpDir, 'skills', 'legacy-skill')
      expect(fs.existsSync(dirPath)).toBe(true)
      expect(fs.statSync(dirPath).isDirectory()).toBe(true)
      expect(fs.existsSync(path.join(dirPath, 'SKILL.md'))).toBe(true)
      expect(fs.existsSync(path.join(dirPath, 'scripts'))).toBe(true)
      expect(fs.existsSync(path.join(dirPath, 'references'))).toBe(true)
      expect(fs.existsSync(path.join(dirPath, 'assets'))).toBe(true)
    })

    it('이미 디렉토리인 skill → 마이그레이션 스킵 (정상 동작)', () => {
      // 디렉토리 형식으로 skill 생성
      store.createSkill({
        name: 'modern-skill',
        description: '현대 스킬',
        prompt: 'Modern skill prompt.',
      })

      // getSkill 여러 번 호출해도 정상 동작
      const skill1 = store.getSkill('modern-skill')
      const skill2 = store.getSkill('modern-skill')

      expect(skill1.name).toBe('modern-skill')
      expect(skill2.name).toBe('modern-skill')

      // 디렉토리 구조 유지 확인
      const dirPath = path.join(tmpDir, 'skills', 'modern-skill')
      expect(fs.existsSync(dirPath)).toBe(true)
      expect(fs.statSync(dirPath).isDirectory()).toBe(true)
    })

    it('listSkills → 레거시 .md 파일 전부 마이그레이션', () => {
      // 레거시 형식으로 여러 skill 파일 직접 생성
      const legacy1 = `---
name: legacy1
description: Legacy 1
---

Prompt 1.`
      const legacy2 = `---
name: legacy2
description: Legacy 2
---

Prompt 2.`
      fs.writeFileSync(path.join(tmpDir, 'skills', 'legacy1.md'), legacy1)
      fs.writeFileSync(path.join(tmpDir, 'skills', 'legacy2.md'), legacy2)

      // listSkills 호출
      const skills = store.listSkills()

      expect(skills).toHaveLength(2)

      // 레거시 파일 삭제 확인
      expect(fs.existsSync(path.join(tmpDir, 'skills', 'legacy1.md'))).toBe(false)
      expect(fs.existsSync(path.join(tmpDir, 'skills', 'legacy2.md'))).toBe(false)

      // 디렉토리로 변환 확인
      expect(fs.existsSync(path.join(tmpDir, 'skills', 'legacy1'))).toBe(true)
      expect(fs.existsSync(path.join(tmpDir, 'skills', 'legacy2'))).toBe(true)
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
