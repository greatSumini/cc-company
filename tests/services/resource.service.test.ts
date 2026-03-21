import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { FsStore } from '../../src/store/fs-store'
import { ResourceService } from '../../src/services/resource.service'
import { AgentService } from '../../src/services/agent.service'

describe('ResourceService', () => {
  let tmpDir: string
  let store: FsStore
  let resourceService: ResourceService
  let agentService: AgentService

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-company-test-'))
    fs.mkdirSync(path.join(tmpDir, 'agents'), { recursive: true })
    fs.mkdirSync(path.join(tmpDir, 'subagents'), { recursive: true })
    fs.mkdirSync(path.join(tmpDir, 'skills'), { recursive: true })
    fs.mkdirSync(path.join(tmpDir, 'hooks'), { recursive: true })
    fs.writeFileSync(
      path.join(tmpDir, 'config.json'),
      JSON.stringify({ version: '1.0.0' })
    )
    store = new FsStore(tmpDir)
    resourceService = new ResourceService(store)
    agentService = new AgentService(store)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('[remove]', () => {
    it('아무 agent에도 할당되지 않은 리소스 삭제 → 정상', () => {
      // 공용 풀에 subagent 생성
      resourceService.createSubagent('git-expert', 'Git 전문가', 'You are a git expert.')

      // 삭제
      resourceService.removeSubagent('git-expert')

      // 확인
      expect(() => store.getSubagent('git-expert')).toThrow('Subagent not found')
    })

    it('할당된 agent가 있는 리소스 삭제 → 경고 메시지 출력', () => {
      // 공용 풀에 subagent 생성
      resourceService.createSubagent('git-expert', 'Git 전문가', 'You are a git expert.')

      // agent에 할당
      agentService.create('developer', '개발자')
      agentService.assignSubagent('developer', 'git-expert')

      // console.warn 스파이
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // 삭제
      resourceService.removeSubagent('git-expert')

      // 경고 출력 확인
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('git-expert')
      )
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('developer')
      )

      // 삭제 확인
      expect(() => store.getSubagent('git-expert')).toThrow('Subagent not found')

      warnSpy.mockRestore()
    })

    it('skill 삭제 - 할당된 agent 있으면 경고', () => {
      resourceService.createSkill('deploy', '배포', 'Deploy prompt')
      agentService.create('developer', '개발자')
      agentService.assignSkill('developer', 'deploy')

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      resourceService.removeSkill('deploy')

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('deploy')
      )

      warnSpy.mockRestore()
    })

    it('hook 삭제 - 할당된 agent 있으면 경고', () => {
      resourceService.createHook('pre-commit', 'Pre-commit', { command: 'lint' })
      agentService.create('developer', '개발자')
      agentService.assignHook('developer', 'pre-commit')

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      resourceService.removeHook('pre-commit')

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('pre-commit')
      )

      warnSpy.mockRestore()
    })
  })

  describe('[basic operations]', () => {
    it('createSubagent and listSubagents', () => {
      resourceService.createSubagent('sub1', 'Subagent 1', 'prompt1')
      resourceService.createSubagent('sub2', 'Subagent 2', 'prompt2')

      const subagents = resourceService.listSubagents()
      expect(subagents).toHaveLength(2)
    })

    it('createSkill and listSkills', () => {
      resourceService.createSkill('skill1', 'Skill 1', 'prompt1')
      resourceService.createSkill('skill2', 'Skill 2', 'prompt2')

      const skills = resourceService.listSkills()
      expect(skills).toHaveLength(2)
    })

    it('createHook and listHooks', () => {
      resourceService.createHook('hook1', 'Hook 1', { cmd: 'lint' })
      resourceService.createHook('hook2', 'Hook 2', { cmd: 'test' })

      const hooks = resourceService.listHooks()
      expect(hooks).toHaveLength(2)
    })
  })

  describe('[Skill show + 불일치 경고]', () => {
    it('showSkill → config + 파일 목록 반환', () => {
      // Skill 생성
      resourceService.createSkill('deploy', '배포', 'Deploy prompt')

      // 파일 추가
      resourceService.addSkillFile('deploy', 'scripts/run.sh', '#!/bin/bash\necho deploy')
      resourceService.addSkillFile('deploy', 'references/schema.json', '{}')

      const result = resourceService.showSkill('deploy')

      expect(result.config.name).toBe('deploy')
      expect(result.config.description).toBe('배포')
      expect(result.config.resources).toContain('scripts/run.sh')
      expect(result.config.resources).toContain('references/schema.json')
      expect(result.files).toContain('scripts/run.sh')
      expect(result.files).toContain('references/schema.json')
      expect(result.warnings).toHaveLength(0)
    })

    it('showSkill resources 불일치 시 경고 출력', () => {
      // Skill 생성
      resourceService.createSkill('deploy', '배포', 'Deploy prompt')

      // 파일 추가 (resources에 자동 등록됨)
      resourceService.addSkillFile('deploy', 'scripts/run.sh', '#!/bin/bash')

      // 파일 직접 추가 (resources에 미등록)
      const skillDir = store.getSkillDir('deploy')
      fs.writeFileSync(path.join(skillDir, 'assets', 'logo.png'), 'fake-image')

      // resources에 없는 파일 직접 등록 (실제 파일은 없음)
      const skillMdPath = path.join(skillDir, 'SKILL.md')
      let content = fs.readFileSync(skillMdPath, 'utf-8')
      content = content.replace(
        'resources:\n  - scripts/run.sh',
        'resources:\n  - scripts/run.sh\n  - missing-file.txt'
      )
      fs.writeFileSync(skillMdPath, content)

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = resourceService.showSkill('deploy')

      // resources에 등록됐지만 파일 없음
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('resources에 등록됐지만 파일 없음')
      )
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('missing-file.txt')
      )

      // 파일 존재하지만 resources에 미등록
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('파일 존재하지만 resources에 미등록')
      )
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('assets/logo.png')
      )

      expect(result.warnings.length).toBeGreaterThan(0)

      warnSpy.mockRestore()
    })
  })
})
