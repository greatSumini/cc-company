import * as fs from 'fs'
import * as path from 'path'
import type { IStore } from '../store/store.js'
import type { RunLogger } from '../types/index.js'
import { buildFlags } from '../claude-runner/flag-builder.js'
import { spawnClaude, type SpawnResult } from '../claude-runner/spawner.js'

export class RunService {
  constructor(
    private store: IStore,
    private rootPath: string,
    private logger?: RunLogger
  ) {}

  run(agentName: string, prompt: string, passthroughFlags: string[]): SpawnResult {
    // 1. agent 존재 확인
    const agent = this.store.getAgent(agentName)

    // 2. 공용 풀에서 리소스 resolve
    const subagents = agent.subagents
      ? this.store.resolveSubagents(agent.subagents)
      : undefined

    // 3. agent 디렉토리 경로 결정
    const agentDir = path.join(this.rootPath, 'agents', agentName)
    const promptFilePath = path.join(agentDir, 'prompt.md')

    // optional 파일 경로 확인
    const settingsFilePath = this.getIfExists(path.join(agentDir, 'settings.json'))
    const mcpConfigFilePath = this.getIfExists(path.join(agentDir, 'mcp.json'))
    const pluginDirPath = this.getIfExists(path.join(agentDir, 'plugins'))

    // 4. buildFlags 호출
    const flags = buildFlags({
      agent,
      promptFilePath,
      subagents,
      settingsFilePath,
      mcpConfigFilePath,
      pluginDirPath,
      prompt,
      passthroughFlags,
    })

    // 5. spawnClaude 호출
    const result = spawnClaude(flags)

    // 6. logger가 있으면 로그 저장
    if (this.logger) {
      this.logger.log(agentName, prompt, 'print', flags, result)
    }

    // 7. SpawnResult 반환
    return result
  }

  private getIfExists(filePath: string): string | undefined {
    return fs.existsSync(filePath) ? filePath : undefined
  }
}
