# Phase 5: agent-runner

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/spec.md`
- `/spec/architecture.md`
- `/spec/adr.md`
- `/tasks/7-ticket-system/spec-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/src/types/index.ts` (Phase 1)
- `/src/services/ticket.service.ts` (Phase 3)
- `/src/server/index.ts` (Phase 4)

기존 claude-runner 구현을 참고하라:

- `/src/claude-runner/spawner.ts`
- `/src/claude-runner/flag-builder.ts`
- `/src/claude-runner/env-builder.ts`
- `/src/services/run.service.ts`

## 작업 내용

Agent Worker의 polling loop와 ticket 처리 로직을 구현한다.

### 1. `src/services/agent-runner.service.ts`

```typescript
import { Ticket, TicketServerConfig, AgentConfig } from '../types'

export interface AgentRunnerDeps {
  serverUrl: string
  config: TicketServerConfig
  agentConfig: AgentConfig
  // 기존 run.service의 claude 실행 로직을 재사용
  runClaude: (prompt: string, agentConfig: AgentConfig) => Promise<{ exitCode: number; output: string }>
}

export class AgentRunnerService {
  private alive = true
  private lastActivityAt: number

  constructor(private deps: AgentRunnerDeps) {
    this.lastActivityAt = Date.now()
  }

  /**
   * 메인 실행 루프
   * - 주기적으로 ticket polling
   * - ticket 발견 시 처리
   * - idle timeout 초과 시 종료
   */
  async run(): Promise<void> {
    const { config, agentConfig } = this.deps

    console.log(`[${agentConfig.name}] Agent worker started`)

    while (this.alive) {
      try {
        // 1. Heartbeat 전송
        await this.sendHeartbeat()

        // 2. 내 ticket 조회 (ready 상태)
        const ticket = await this.pollTicket()

        if (ticket) {
          this.lastActivityAt = Date.now()
          await this.processTicket(ticket)
        }

        // 3. Idle timeout 체크
        const idleTime = Date.now() - this.lastActivityAt
        if (idleTime > config.idleTimeoutMs) {
          console.log(`[${agentConfig.name}] Idle timeout reached, shutting down`)
          break
        }

        // 4. 대기
        await this.sleep(config.pollingIntervalMs)
      } catch (error) {
        console.error(`[${agentConfig.name}] Error in run loop:`, error)
        await this.sleep(config.pollingIntervalMs)
      }
    }

    // 종료 시 상태 업데이트
    await this.updateState('offline')
    console.log(`[${agentConfig.name}] Agent worker stopped`)
  }

  /**
   * 종료 신호
   */
  stop(): void {
    this.alive = false
  }

  private async sendHeartbeat(): Promise<void> {
    const { serverUrl, agentConfig } = this.deps
    await fetch(`${serverUrl}/agents/${agentConfig.name}/heartbeat`, {
      method: 'PATCH',
    })
  }

  private async updateState(state: 'idle' | 'working' | 'offline', currentTicketId?: string): Promise<void> {
    const { serverUrl, agentConfig } = this.deps
    await fetch(`${serverUrl}/agents/${agentConfig.name}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, currentTicketId }),
    })
  }

  private async pollTicket(): Promise<Ticket | null> {
    const { serverUrl, agentConfig } = this.deps
    const res = await fetch(
      `${serverUrl}/tickets?assignee=${agentConfig.name}&status=ready`
    )
    const tickets: Ticket[] = await res.json()

    // 첫 번째 ticket 반환 (이미 priority, createdAt 순 정렬됨)
    return tickets[0] ?? null
  }

  private async processTicket(ticket: Ticket): Promise<void> {
    const { serverUrl, agentConfig, runClaude } = this.deps

    console.log(`[${agentConfig.name}] Processing ticket: ${ticket.id} (${ticket.title})`)

    try {
      // 1. 상태 업데이트: in_progress
      await this.updateState('working', ticket.id)
      const updatedTicket = await this.updateTicketStatus(ticket.id, 'in_progress', ticket.version)

      // 2. Ticket 타입에 따라 처리
      let result: { exitCode: number; output: string }

      if (ticket.type === 'cc_review') {
        result = await this.processCcReview(ticket)
      } else {
        result = await this.processTask(ticket)
      }

      // 3. 로그 저장
      await this.saveLog(ticket.id, result.output)

      // 4. 상태 업데이트: completed 또는 failed
      const finalStatus = result.exitCode === 0 ? 'completed' : 'failed'
      await this.updateTicketStatus(ticket.id, finalStatus, updatedTicket.version, {
        exitCode: result.exitCode,
        logPath: `tickets/${ticket.id}/execution.log`,
      })

      // 5. cc_review 완료 시 parent 체크
      if (ticket.type === 'cc_review' && ticket.parentTicketId && finalStatus === 'completed') {
        await this.checkCcCompletion(ticket.parentTicketId)
      }

      // 6. 상태 복구: idle
      await this.updateState('idle')

      console.log(`[${agentConfig.name}] Ticket ${ticket.id} ${finalStatus}`)
    } catch (error) {
      console.error(`[${agentConfig.name}] Error processing ticket ${ticket.id}:`, error)
      await this.updateState('idle')
      throw error
    }
  }

  private async processCcReview(ticket: Ticket): Promise<{ exitCode: number; output: string }> {
    const { serverUrl, runClaude, agentConfig } = this.deps

    // 1. Parent ticket 조회
    const parentRes = await fetch(`${serverUrl}/tickets/${ticket.parentTicketId}`)
    const parent: Ticket = await parentRes.json()

    // 2. Review prompt 생성
    const reviewPrompt = `
아래 작업 요청에 대해 검토하고 의견을 제시하세요.

## 작업 제목
${parent.title}

## 작업 내용
${parent.prompt}

---

위 작업에 대해 검토 의견이 있으면 작성하세요.
의견이 없으면 "확인함"이라고만 응답하세요.
`.trim()

    // 3. Claude 실행
    const result = await runClaude(reviewPrompt, agentConfig)

    // 4. 결과를 comment로 추가
    await fetch(`${serverUrl}/tickets/${ticket.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author: agentConfig.name,
        content: result.output.trim(),
      }),
    })

    return result
  }

  private async processTask(ticket: Ticket): Promise<{ exitCode: number; output: string }> {
    const { runClaude, agentConfig } = this.deps

    // Claude 실행
    return await runClaude(ticket.prompt, agentConfig)
  }

  private async updateTicketStatus(
    ticketId: string,
    status: string,
    expectedVersion: number,
    result?: { exitCode: number; logPath: string }
  ): Promise<Ticket> {
    const { serverUrl } = this.deps
    const res = await fetch(`${serverUrl}/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, expectedVersion, result }),
    })
    return await res.json()
  }

  private async saveLog(ticketId: string, log: string): Promise<void> {
    // 직접 파일 저장 (HTTP API 대신)
    // 이 부분은 Phase 6에서 deps에 ticketService를 주입받아 처리
    // 여기서는 HTTP로 처리 불가하므로 일단 console.log로 대체
    // TODO: ticketService.saveLog() 호출로 변경
    console.log(`[Log saved for ticket ${ticketId}]`)
  }

  private async checkCcCompletion(parentTicketId: string): Promise<void> {
    // TicketService.checkCcCompletion()을 HTTP로 트리거
    // 현재 HTTP API에 없으므로, 서버 내부에서 자동 처리되도록 설계
    // cc_review가 completed되면 서버가 자동으로 parent 체크
    // 여기서는 아무것도 하지 않음 (서버 책임)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
```

### 2. `src/services/ticket.service.ts` 수정

`updateTicketStatus()` 메서드에서 cc_review가 completed될 때 자동으로 `checkCcCompletion()` 호출:

```typescript
async updateTicketStatus(
  id: string,
  status: Ticket['status'],
  expectedVersion: number,
  result?: Ticket['result']
): Promise<Ticket> {
  const ticket = await this.ticketStore.get(id)
  if (!ticket) {
    throw new TicketNotFoundError(id)
  }

  const update: UpdateTicketInput = {
    status,
    expectedVersion,
  }

  if (status === 'in_progress' && !ticket.startedAt) {
    update.startedAt = new Date().toISOString()
  }

  if ((status === 'completed' || status === 'failed') && !ticket.completedAt) {
    update.completedAt = new Date().toISOString()
    if (result) {
      update.result = result
    }
  }

  const updated = await this.ticketStore.update(id, update)

  // cc_review가 completed되면 parent 체크
  if (ticket.type === 'cc_review' && status === 'completed' && ticket.parentTicketId) {
    await this.checkCcCompletion(ticket.parentTicketId)
  }

  return updated
}
```

### 3. Claude 실행 함수 추출

기존 `run.service.ts`의 claude 실행 로직을 재사용할 수 있도록 함수로 추출한다.

`src/claude-runner/run-claude.ts` (신규):

```typescript
import { AgentConfig, SubagentConfig, SkillConfig } from '../types'
import { buildFlags, FlagBuilderInput } from './flag-builder'
import { buildEnv } from './env-builder'
import { spawnClaude } from './spawner'
import { IStore } from '../store/store'
import * as fs from 'fs'
import * as path from 'path'
import { randomUUID } from 'crypto'

export interface RunClaudeOptions {
  store: IStore
  basePath: string
}

export async function runClaude(
  prompt: string,
  agentConfig: AgentConfig,
  options: RunClaudeOptions
): Promise<{ exitCode: number; output: string }> {
  const { store, basePath } = options

  // 1. Subagents resolve
  const subagents: SubagentConfig[] = []
  if (agentConfig.subagents) {
    for (const name of agentConfig.subagents) {
      const sub = store.getSubagent(name)
      if (sub) subagents.push(sub)
    }
  }

  // 2. Skills를 임시 디렉토리에 복사
  let addDirPath: string | undefined
  if (agentConfig.skills && agentConfig.skills.length > 0) {
    const tmpDir = path.join(basePath, '.tmp', `run-${randomUUID()}`)
    const skillsDir = path.join(tmpDir, '.claude', 'skills')
    fs.mkdirSync(skillsDir, { recursive: true })

    for (const skillName of agentConfig.skills) {
      const skillDir = store.getSkillDir(skillName)
      if (skillDir && fs.existsSync(skillDir)) {
        const destDir = path.join(skillsDir, skillName)
        fs.cpSync(skillDir, destDir, { recursive: true })
      }
    }

    addDirPath = tmpDir
  }

  try {
    // 3. Flags 빌드
    const agentDir = path.join(basePath, 'agents', agentConfig.name)
    const promptFilePath = path.join(agentDir, 'prompt.md')
    const settingsPath = path.join(agentDir, 'settings.json')
    const mcpConfigPath = path.join(agentDir, 'mcp.json')

    const flagInput: FlagBuilderInput = {
      promptFilePath,
      subagents: subagents.length > 0 ? subagents : undefined,
      settingsPath: fs.existsSync(settingsPath) ? settingsPath : undefined,
      mcpConfigPath: fs.existsSync(mcpConfigPath) ? mcpConfigPath : undefined,
      addDirPath,
      passthroughFlags: ['-p'], // print mode
      prompt,
    }

    const flags = buildFlags(flagInput)

    // 4. Env 빌드
    const env = await buildEnv(agentConfig.gh_user)

    // 5. Claude 실행
    const result = spawnClaude(flags, env)

    return {
      exitCode: result.exitCode,
      output: result.stdout || result.stderr || '',
    }
  } finally {
    // 6. 임시 디렉토리 정리
    if (addDirPath && fs.existsSync(addDirPath)) {
      fs.rmSync(addDirPath, { recursive: true, force: true })
    }
  }
}
```

## Acceptance Criteria

```bash
npm run build  # 컴파일 에러 없음
npm test       # 모든 테스트 통과
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/7-ticket-system/index.json`의 phase 5 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- `AgentRunnerService`는 테스트하지 않는다 (claude spawn mock은 가치 없음).
- `runClaude` 함수는 기존 `run.service.ts`의 로직을 최대한 재사용하라. 중복 코드를 만들지 마라.
- HTTP 요청 실패 시 적절히 에러 처리하라. 네트워크 에러로 인한 크래시 방지.
- `fetch`는 Node.js 18+ 내장 fetch를 사용한다. 별도 패키지 불필요.
