import * as fs from 'fs'
import * as path from 'path'
import { FsStore, AgentService, ResourceService } from '@agentinc/core'
import { RunService } from '../services/run.service.js'
import { RunLogger } from '../logger/run-logger.js'

export interface CommandContext {
  basePath: string // process.cwd() - 프로젝트 루트
  rootPath: string // .agentinc 디렉토리 경로
  store: FsStore
  agentService: AgentService
  resourceService: ResourceService
  runService: RunService
}

export function getRootPath(): string {
  return path.join(process.cwd(), '.agentinc')
}

export function ensureInitialized(): void {
  const rootPath = getRootPath()
  if (!fs.existsSync(rootPath)) {
    console.error('agentinc가 초기화되지 않았습니다. `agentinc init`을 먼저 실행하세요.')
    process.exit(1)
  }
}

export function createContext(): CommandContext {
  ensureInitialized()

  const basePath = process.cwd()
  const rootPath = getRootPath()
  const store = new FsStore(rootPath)
  const logger = new RunLogger(path.join(rootPath, 'runs'))

  return {
    basePath,
    rootPath,
    store,
    agentService: new AgentService(store),
    resourceService: new ResourceService(store),
    runService: new RunService(store, rootPath, logger),
  }
}
