import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { FsStore } from '../../src/store/fs-store'
import { RunService } from '../../src/services/run.service'
import type { RunLogger } from '../../src/types'

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
  })

  afterEach(() => {
    delete process.env.CC_DRY_RUN
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('[run]', () => {
    it('존재하지 않는 agent로 run → 에러', () => {
      expect(() =>
        runService.run('nonexistent', 'test prompt', [])
      ).toThrow('Agent not found: nonexistent')
    })

    it('정상 실행 → SpawnResult 반환', () => {
      // agent 생성
      store.createAgent({ name: 'developer', description: '개발자' })

      // 실행
      const result = runService.run('developer', '버그 고쳐줘', [])

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
      runServiceWithLogger.run('developer', '버그 고쳐줘', ['--model', 'opus'])

      // logger.log 호출 확인
      expect(mockLogger.log).toHaveBeenCalledWith(
        'developer',
        '버그 고쳐줘',
        'print',
        expect.arrayContaining(['--append-system-prompt-file']),
        expect.objectContaining({ exitCode: 0 })
      )
    })

    it('exitCode 전파 확인 (dry-run에서는 항상 0)', () => {
      // agent 생성
      store.createAgent({ name: 'developer', description: '개발자' })

      // dry-run 모드에서는 exitCode가 항상 0
      const result = runService.run('developer', 'test', [])
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
      runService.run('developer', 'test', [])

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

      runService.run('developer', 'test', [])

      const output = writeSpy.mock.calls
        .map((call) => call[0])
        .join('')
      expect(output).toContain('--settings')

      writeSpy.mockRestore()
    })

    it('passthrough flags가 전달됨', () => {
      store.createAgent({ name: 'developer', description: '개발자' })

      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

      runService.run('developer', 'test', ['--model', 'opus', '-p'])

      const output = writeSpy.mock.calls
        .map((call) => call[0])
        .join('')
      expect(output).toContain('--model')
      expect(output).toContain('opus')
      expect(output).toContain('-p')

      writeSpy.mockRestore()
    })
  })
})
