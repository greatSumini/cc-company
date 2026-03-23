import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import type { IStore, AgentConfig, SkillConfig } from '@agentinc/core'
import { buildFlags } from './flag-builder.js'
import { buildEnv } from './env-builder.js'
import { spawnClaude } from './spawner.js'

export interface RunClaudeOptions {
  store: IStore
  basePath: string
}

export interface RunClaudeResult {
  exitCode: number
  output: string
}

/**
 * Claude CLI를 실행한다.
 * 기존 run.service.ts의 로직을 재사용하여 agent-runner에서도 사용 가능하도록 추출.
 */
export function runClaude(
  prompt: string,
  agentConfig: AgentConfig,
  options: RunClaudeOptions
): RunClaudeResult {
  const { store, basePath } = options

  // 1. Subagents resolve
  const subagents = agentConfig.subagents
    ? store.resolveSubagents(agentConfig.subagents)
    : undefined

  // 2. Skills를 임시 디렉토리에 복사
  let tmpDir: string | null = null
  let addDirPath: string | undefined

  if (agentConfig.skills && agentConfig.skills.length > 0) {
    const skills = store.resolveSkills(agentConfig.skills)

    // resource 불일치 경고
    for (const skill of skills) {
      warnResourceMismatch(skill, store)
    }

    // 임시 디렉토리 생성
    const uuid = crypto.randomUUID()
    tmpDir = path.join(basePath, '.tmp', `run-${uuid}`)
    const skillsDir = path.join(tmpDir, '.claude', 'skills')
    fs.mkdirSync(skillsDir, { recursive: true })

    // skill 디렉토리 복사
    for (const skill of skills) {
      const srcDir = store.getSkillDir(skill.name)
      const destDir = path.join(skillsDir, skill.name)
      fs.cpSync(srcDir, destDir, { recursive: true })
    }

    addDirPath = tmpDir
  }

  try {
    // 3. Flags 빌드
    const agentDir = path.join(basePath, 'agents', agentConfig.name)
    const promptFilePath = path.join(agentDir, 'prompt.md')
    const settingsFilePath = getIfExists(path.join(agentDir, 'settings.json'))
    const mcpConfigFilePath = getIfExists(path.join(agentDir, 'mcp.json'))

    const flags = buildFlags({
      agent: agentConfig,
      promptFilePath,
      subagents,
      settingsFilePath,
      mcpConfigFilePath,
      addDirPath,
      prompt,
      passthroughFlags: ['-p'], // print mode
    })

    // 4. Env 빌드
    const env = buildEnv(agentConfig.gh_user)

    // 5. Claude 실행
    const result = spawnClaude(flags, env)

    return {
      exitCode: result.exitCode,
      output: result.stdout || result.stderr || '',
    }
  } finally {
    // 6. 임시 디렉토리 정리
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  }
}

function getIfExists(filePath: string): string | undefined {
  return fs.existsSync(filePath) ? filePath : undefined
}

function warnResourceMismatch(skill: SkillConfig, store: IStore): void {
  const skillDir = store.getSkillDir(skill.name)
  const registeredResources = new Set(skill.resources ?? [])

  // 1. resources에 등록됐지만 파일 없음
  for (const resource of registeredResources) {
    const filePath = path.join(skillDir, resource)
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠ skill "${skill.name}": resources에 등록됐지만 파일 없음 — ${resource}`)
    }
  }

  // 2. 파일 존재하지만 resources에 미등록 (SKILL.md 제외)
  const actualFiles = collectFiles(skillDir, '')
  for (const file of actualFiles) {
    if (file === 'SKILL.md') continue
    if (!registeredResources.has(file)) {
      console.warn(`⚠ skill "${skill.name}": 파일 존재하지만 resources에 미등록 — ${file}`)
    }
  }
}

function collectFiles(baseDir: string, relativePath: string): string[] {
  const result: string[] = []
  const fullPath = relativePath ? path.join(baseDir, relativePath) : baseDir

  for (const entry of fs.readdirSync(fullPath, { withFileTypes: true })) {
    const entryRelPath = relativePath ? path.join(relativePath, entry.name) : entry.name
    if (entry.isDirectory()) {
      const subFiles = collectFiles(baseDir, entryRelPath)
      result.push(...subFiles)
    } else {
      result.push(entryRelPath)
    }
  }

  return result
}
