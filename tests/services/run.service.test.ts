import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { FsStore } from '../../src/store/fs-store'
import { RunService } from '../../src/services/run.service'
import { spawnClaude } from '../../src/claude-runner/spawner'
import type { RunLogger } from '../../src/types'

// spawnClaude 모킹을 위한 준비
vi.mock('../../src/claude-runner/spawner', async () => {
  const actual = await vi.importActual('../../src/claude-runner/spawner')
  return {
    ...actual,
    spawnClaude: vi.fn((flags: string[]) => {
      // dry-run 모드이면 기본 동작
      if (process.env.CC_DRY_RUN === '1') {
        process.stdout.write(`[DRY_RUN] claude ${flags.join(' ')}\n`)
        return { exitCode: 0, stdout: '', stderr: '' }
      }
      return { exitCode: 0, stdout: '', stderr: '' }
    }),
  }
})

describe('RunService', () => {
  let tmpDir: string
  let store: FsStore
  let runService: RunService

  beforeEach(() => {
    // dry-run 모드 설정
    process.env.CC_DRY_RUN = '1'

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
    runService = new RunService(store, tmpDir)

    // spawnClaude 모킹 리셋
    vi.mocked(spawnClaude).mockClear()
    vi.mocked(spawnClaude).mockImplementation((flags: string[]) => {
      process.stdout.write(`[DRY_RUN] claude ${flags.join(' ')}\n`)
      return { exitCode: 0, stdout: '', stderr: '' }
    })
  })

  afterEach(() => {
    delete process.env.CC_DRY_RUN
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('[run]', () => {
    it('존재하지 않는 agent로 run → 에러', () => {
      expect(() =>
        runService.run('nonexistent', 'test prompt', 'print', [])
      ).toThrow('Agent not found: nonexistent')
    })

    it('정상 실행 → SpawnResult 반환', () => {
      // agent 생성
      store.createAgent({ name: 'developer', description: '개발자' })

      // 실행
      const result = runService.run('developer', '버그 고쳐줘', 'print', [])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe('')
      expect(result.stderr).toBe('')
    })

    it('정상 실행 → 로그에 기록 (logger가 있을 때)', () => {
      // agent 생성
      store.createAgent({ name: 'developer', description: '개발자' })

      // mock logger
      const mockLogger: RunLogger = {
        log: vi.fn(),
      }

      const runServiceWithLogger = new RunService(store, tmpDir, mockLogger)

      // 실행
      runServiceWithLogger.run('developer', '버그 고쳐줘', 'print', ['--model', 'opus'])

      // logger.log 호출 확인
      expect(mockLogger.log).toHaveBeenCalledWith(
        'developer',
        '버그 고쳐줘',
        'print',
        expect.arrayContaining(['--append-system-prompt-file']),
        expect.objectContaining({ exitCode: 0 }),
        expect.any(Date),
        expect.any(Date)
      )
    })

    it('exitCode 전파 확인 (dry-run에서는 항상 0)', () => {
      // agent 생성
      store.createAgent({ name: 'developer', description: '개발자' })

      // dry-run 모드에서는 exitCode가 항상 0
      const result = runService.run('developer', 'test', 'print', [])
      expect(result.exitCode).toBe(0)
    })

    it('subagent가 있으면 resolve하여 flags에 포함', () => {
      // agent 생성
      store.createAgent({
        name: 'developer',
        description: '개발자',
        subagents: ['git-expert'],
      })

      // 공용 풀에 subagent 생성
      store.createSubagent({
        name: 'git-expert',
        description: 'Git 전문가',
        prompt: 'You are a git expert.',
      })

      // stdout을 캡처
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

      // 실행
      runService.run('developer', 'test', 'print', [])

      // dry-run 출력에 --agents가 포함되어 있는지 확인
      expect(writeSpy).toHaveBeenCalled()
      const output = writeSpy.mock.calls
        .map((call) => call[0])
        .join('')
      expect(output).toContain('--agents')
      expect(output).toContain('git-expert')

      writeSpy.mockRestore()
    })

    it('settings.json이 있으면 flags에 포함', () => {
      // agent 생성
      store.createAgent({ name: 'developer', description: '개발자' })

      // agent 디렉토리에 settings.json 생성
      const agentDir = path.join(tmpDir, 'agents', 'developer')
      fs.writeFileSync(
        path.join(agentDir, 'settings.json'),
        JSON.stringify({ model: 'opus' })
      )

      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

      runService.run('developer', 'test', 'print', [])

      const output = writeSpy.mock.calls
        .map((call) => call[0])
        .join('')
      expect(output).toContain('--settings')

      writeSpy.mockRestore()
    })

    it('passthrough flags가 전달됨', () => {
      store.createAgent({ name: 'developer', description: '개발자' })

      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

      runService.run('developer', 'test', 'print', ['--model', 'opus', '-p'])

      const output = writeSpy.mock.calls
        .map((call) => call[0])
        .join('')
      expect(output).toContain('--model')
      expect(output).toContain('opus')
      expect(output).toContain('-p')

      writeSpy.mockRestore()
    })

    it('prompt 없이 interactive mode로 실행', () => {
      store.createAgent({ name: 'developer', description: '개발자' })

      const result = runService.run('developer', null, 'interactive', [])

      expect(result.exitCode).toBe(0)
    })

    it('interactive mode + prompt로 실행', () => {
      store.createAgent({ name: 'developer', description: '개발자' })

      const result = runService.run('developer', '버그 고쳐줘', 'interactive', [])

      expect(result.exitCode).toBe(0)
    })

    it('logger에 mode가 전달되는지 확인', () => {
      store.createAgent({ name: 'developer', description: '개발자' })

      const mockLogger: RunLogger = {
        log: vi.fn(),
      }

      const runServiceWithLogger = new RunService(store, tmpDir, mockLogger)
      runServiceWithLogger.run('developer', null, 'interactive', [])

      expect(mockLogger.log).toHaveBeenCalledWith(
        'developer',
        null,
        'interactive',
        expect.any(Array),
        expect.objectContaining({ exitCode: 0 }),
        expect.any(Date),
        expect.any(Date)
      )
    })
  })

  describe('[--add-dir 차단]', () => {
    it('passthroughFlags에 --add-dir 포함 → 에러', () => {
      store.createAgent({ name: 'developer', description: '개발자' })

      expect(() =>
        runService.run('developer', 'test', 'print', ['--add-dir', '/some/path'])
      ).toThrow('--add-dir is managed internally by cc-company. Do not pass it directly.')
    })
  })

  describe('[--add-dir 임시 디렉토리]', () => {
    it('skills 있는 agent run → .tmp/run-{uuid}/.claude/skills/ 에 디렉토리 복사', () => {
      // skill 생성
      store.createSkill({
        name: 'deploy',
        description: '배포 스킬',
        prompt: 'You are a deployment expert.',
      })
      // 보조 파일 추가
      store.addSkillFile('deploy', 'scripts/run.sh', '#!/bin/bash\necho deploy')

      // agent 생성 (skill 할당)
      store.createAgent({
        name: 'deployer',
        description: '배포 에이전트',
        skills: ['deploy'],
      })

      // spawnClaude 호출 시 임시 디렉토리 존재 확인
      let capturedAddDirPath: string | null = null
      vi.mocked(spawnClaude).mockImplementation((flags: string[]) => {
        const addDirIndex = flags.indexOf('--add-dir')
        if (addDirIndex !== -1) {
          capturedAddDirPath = flags[addDirIndex + 1]
          // 임시 디렉토리가 존재하는지 확인
          expect(fs.existsSync(capturedAddDirPath)).toBe(true)
          // .claude/skills/deploy 디렉토리 존재 확인
          const skillDir = path.join(capturedAddDirPath, '.claude', 'skills', 'deploy')
          expect(fs.existsSync(skillDir)).toBe(true)
          // SKILL.md 복사 확인
          expect(fs.existsSync(path.join(skillDir, 'SKILL.md'))).toBe(true)
          // 보조 파일 복사 확인
          expect(fs.existsSync(path.join(skillDir, 'scripts', 'run.sh'))).toBe(true)
        }
        return { exitCode: 0, stdout: '', stderr: '' }
      })

      runService.run('deployer', 'deploy now', 'print', [])

      // --add-dir가 플래그에 포함되었는지 확인
      expect(capturedAddDirPath).not.toBeNull()
    })

    it('skills 없는 agent run → .tmp 생성하지 않음, --add-dir 없음', () => {
      store.createAgent({ name: 'developer', description: '개발자' })

      vi.mocked(spawnClaude).mockImplementation((flags: string[]) => {
        // --add-dir가 없어야 함
        expect(flags.includes('--add-dir')).toBe(false)
        return { exitCode: 0, stdout: '', stderr: '' }
      })

      runService.run('developer', 'test', 'print', [])

      // .tmp 디렉토리가 생성되지 않았는지 확인
      const tmpBase = path.join(tmpDir, '.tmp')
      const exists = fs.existsSync(tmpBase)
      if (exists) {
        const entries = fs.readdirSync(tmpBase)
        // run-* 디렉토리가 없어야 함
        expect(entries.filter((e) => e.startsWith('run-'))).toHaveLength(0)
      }
    })

    it('실행 완료 후 임시 디렉토리 정리됨', () => {
      // skill 생성
      store.createSkill({
        name: 'deploy',
        description: '배포 스킬',
        prompt: 'You are a deployment expert.',
      })

      // agent 생성 (skill 할당)
      store.createAgent({
        name: 'deployer',
        description: '배포 에이전트',
        skills: ['deploy'],
      })

      // 임시 디렉토리 경로 캡처
      let capturedAddDirPath: string | null = null
      vi.mocked(spawnClaude).mockImplementation((flags: string[]) => {
        const addDirIndex = flags.indexOf('--add-dir')
        if (addDirIndex !== -1) {
          capturedAddDirPath = flags[addDirIndex + 1]
        }
        return { exitCode: 0, stdout: '', stderr: '' }
      })

      runService.run('deployer', 'deploy now', 'print', [])

      // 실행 완료 후 임시 디렉토리가 삭제되어야 함
      expect(capturedAddDirPath).not.toBeNull()
      expect(fs.existsSync(capturedAddDirPath!)).toBe(false)
    })
  })

  describe('[stale 정리]', () => {
    it('1시간 이상 경과한 .tmp/run-* 디렉토리 → run 시 자동 삭제', () => {
      // stale 디렉토리 생성
      const tmpBase = path.join(tmpDir, '.tmp')
      const staleDirPath = path.join(tmpBase, 'run-stale-test')
      fs.mkdirSync(staleDirPath, { recursive: true })
      fs.writeFileSync(path.join(staleDirPath, 'test.txt'), 'test')

      // 1시간 이상 이전으로 mtime 설정
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
      fs.utimesSync(staleDirPath, twoHoursAgo, twoHoursAgo)

      // agent 생성 및 run
      store.createAgent({ name: 'developer', description: '개발자' })
      runService.run('developer', 'test', 'print', [])

      // stale 디렉토리가 삭제되었는지 확인
      expect(fs.existsSync(staleDirPath)).toBe(false)
    })

    it('1시간 미만 .tmp/run-* → 삭제하지 않음', () => {
      // 최근 디렉토리 생성
      const tmpBase = path.join(tmpDir, '.tmp')
      const recentDirPath = path.join(tmpBase, 'run-recent-test')
      fs.mkdirSync(recentDirPath, { recursive: true })
      fs.writeFileSync(path.join(recentDirPath, 'test.txt'), 'test')

      // 30분 전으로 mtime 설정 (1시간 미만)
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
      fs.utimesSync(recentDirPath, thirtyMinutesAgo, thirtyMinutesAgo)

      // agent 생성 및 run
      store.createAgent({ name: 'developer', description: '개발자' })
      runService.run('developer', 'test', 'print', [])

      // 최근 디렉토리는 삭제되지 않아야 함
      expect(fs.existsSync(recentDirPath)).toBe(true)

      // cleanup
      fs.rmSync(recentDirPath, { recursive: true, force: true })
    })
  })

  describe('[resources 불일치 경고]', () => {
    it('resources에 등록됐지만 파일 없음 → console.warn', () => {
      // skill 생성
      store.createSkill({
        name: 'deploy',
        description: '배포 스킬',
        prompt: 'You are a deployment expert.',
        resources: ['scripts/missing.sh'], // 존재하지 않는 파일
      })

      // agent 생성 (skill 할당)
      store.createAgent({
        name: 'deployer',
        description: '배포 에이전트',
        skills: ['deploy'],
      })

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      runService.run('deployer', 'test', 'print', [])

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('resources에 등록됐지만 파일 없음')
      )
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('scripts/missing.sh')
      )

      warnSpy.mockRestore()
    })

    it('파일 존재하지만 resources에 미등록 → console.warn', () => {
      // skill 생성
      store.createSkill({
        name: 'deploy',
        description: '배포 스킬',
        prompt: 'You are a deployment expert.',
        // resources 없음
      })

      // 파일 수동 추가 (resources에 등록 안 함)
      const skillDir = store.getSkillDir('deploy')
      const filePath = path.join(skillDir, 'assets', 'logo.png')
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, 'fake png content')

      // agent 생성 (skill 할당)
      store.createAgent({
        name: 'deployer',
        description: '배포 에이전트',
        skills: ['deploy'],
      })

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      runService.run('deployer', 'test', 'print', [])

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('파일 존재하지만 resources에 미등록')
      )
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('assets/logo.png')
      )

      warnSpy.mockRestore()
    })
  })
})
