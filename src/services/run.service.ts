import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import type { IStore } from '../store/store.js'
import type { RunLogger, SkillConfig } from '../types/index.js'
import { buildFlags } from '../claude-runner/flag-builder.js'
import { spawnClaude, type SpawnResult } from '../claude-runner/spawner.js'

export class RunService {
  constructor(
    private store: IStore,
    private rootPath: string,
    private logger?: RunLogger
  ) {}

  run(agentName: string, prompt: string | null, mode: 'interactive' | 'print', passthroughFlags: string[]): SpawnResult {
    // ADR-014: --add-dir는 cc-company 내부 전용
    if (passthroughFlags.includes('--add-dir')) {
      throw new Error('--add-dir is managed internally by cc-company. Do not pass it directly.')
    }

    // stale 임시 디렉토리 정리
    this.cleanStaleTmpDirs()

    // 1. agent 존재 확인
    const agent = this.store.getAgent(agentName)

    // 2. 공용 풀에서 리소스 resolve
    const subagents = agent.subagents
      ? this.store.resolveSubagents(agent.subagents)
      : undefined

    // 3. skills resolve 및 임시 디렉토리 생성
    let tmpDir: string | null = null
    let addDirPath: string | undefined

    if (agent.skills && agent.skills.length > 0) {
      const skills = this.store.resolveSkills(agent.skills)

      // resource 불일치 경고 (복사 전 체크)
      for (const skill of skills) {
        this.warnResourceMismatch(skill)
      }

      // 임시 디렉토리 생성
      const uuid = crypto.randomUUID()
      tmpDir = path.join(this.rootPath, '.tmp', `run-${uuid}`)
      const skillsDir = path.join(tmpDir, '.claude', 'skills')
      fs.mkdirSync(skillsDir, { recursive: true })

      // skill 디렉토리 복사
      for (const skill of skills) {
        const srcDir = this.store.getSkillDir(skill.name)
        const destDir = path.join(skillsDir, skill.name)
        fs.cpSync(srcDir, destDir, { recursive: true })
      }

      addDirPath = tmpDir
    }

    // 4. agent 디렉토리 경로 결정
    const agentDir = path.join(this.rootPath, 'agents', agentName)
    const promptFilePath = path.join(agentDir, 'prompt.md')

    // optional 파일 경로 확인
    const settingsFilePath = this.getIfExists(path.join(agentDir, 'settings.json'))
    const mcpConfigFilePath = this.getIfExists(path.join(agentDir, 'mcp.json'))

    // 5. buildFlags 호출
    const flags = buildFlags({
      agent,
      promptFilePath,
      subagents,
      settingsFilePath,
      mcpConfigFilePath,
      addDirPath,
      prompt: prompt ?? undefined,
      passthroughFlags,
    })

    // 6. spawnClaude 호출 (try/finally로 정리 보장)
    const startedAt = new Date()
    try {
      const result = spawnClaude(flags)
      const finishedAt = new Date()

      // logger가 있으면 로그 저장
      if (this.logger) {
        this.logger.log(agentName, prompt, mode, flags, result, startedAt, finishedAt)
      }

      return result
    } finally {
      // 임시 디렉토리 정리
      if (tmpDir) {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
    }
  }

  private getIfExists(filePath: string): string | undefined {
    return fs.existsSync(filePath) ? filePath : undefined
  }

  private cleanStaleTmpDirs(): void {
    const tmpBase = path.join(this.rootPath, '.tmp')
    if (!fs.existsSync(tmpBase)) return

    const ONE_HOUR = 60 * 60 * 1000
    const now = Date.now()

    for (const entry of fs.readdirSync(tmpBase, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith('run-')) continue
      const dirPath = path.join(tmpBase, entry.name)
      try {
        const stat = fs.statSync(dirPath)
        if (now - stat.mtimeMs > ONE_HOUR) {
          fs.rmSync(dirPath, { recursive: true, force: true })
        }
      } catch {
        // best-effort: 실패해도 조용히 넘어감
      }
    }
  }

  private warnResourceMismatch(skill: SkillConfig): void {
    const skillDir = this.store.getSkillDir(skill.name)
    const registeredResources = new Set(skill.resources ?? [])

    // 1. resources에 등록됐지만 파일 없음
    for (const resource of registeredResources) {
      const filePath = path.join(skillDir, resource)
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠ skill "${skill.name}": resources에 등록됐지만 파일 없음 — ${resource}`)
      }
    }

    // 2. 파일 존재하지만 resources에 미등록 (SKILL.md 제외, 빈 디렉토리 제외)
    const actualFiles = this.collectFiles(skillDir, '')
    for (const file of actualFiles) {
      if (file === 'SKILL.md') continue
      if (!registeredResources.has(file)) {
        console.warn(`⚠ skill "${skill.name}": 파일 존재하지만 resources에 미등록 — ${file}`)
      }
    }
  }

  private collectFiles(baseDir: string, relativePath: string): string[] {
    const result: string[] = []
    const fullPath = relativePath ? path.join(baseDir, relativePath) : baseDir

    for (const entry of fs.readdirSync(fullPath, { withFileTypes: true })) {
      const entryRelPath = relativePath ? path.join(relativePath, entry.name) : entry.name
      if (entry.isDirectory()) {
        const subFiles = this.collectFiles(baseDir, entryRelPath)
        result.push(...subFiles)
      } else {
        result.push(entryRelPath)
      }
    }

    return result
  }
}
