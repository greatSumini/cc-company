import type { Ticket, TicketServerConfig, AgentConfig } from '@agentinc/core'
import { MergeService } from '@agentinc/core'
import { GhClient } from '../gh-client/index.js'

export interface RunClaudeResult {
  exitCode: number
  output: string
}

export interface AgentRunnerDeps {
  serverUrl: string
  config: TicketServerConfig
  agentConfig: AgentConfig
  workingDir: string
  // 기존 run.service의 claude 실행 로직을 재사용
  runClaude: (prompt: string, agentConfig: AgentConfig) => RunClaudeResult
}

export class AgentRunnerService {
  private alive = true
  private lastActivityAt: number
  private mergeService: MergeService

  constructor(private deps: AgentRunnerDeps) {
    this.lastActivityAt = Date.now()
    // MergeService 초기화
    this.mergeService = new MergeService({
      ghClient: new GhClient(deps.agentConfig.gh_user),
      serverUrl: deps.serverUrl,
      workingDir: deps.workingDir,
    })
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
    try {
      await fetch(`${serverUrl}/agents/${agentConfig.name}/heartbeat`, {
        method: 'PATCH',
      })
    } catch (error) {
      console.error(`[${agentConfig.name}] Failed to send heartbeat:`, error)
    }
  }

  private async updateState(state: 'idle' | 'working' | 'offline', currentTicketId?: string): Promise<void> {
    const { serverUrl, agentConfig } = this.deps
    try {
      await fetch(`${serverUrl}/agents/${agentConfig.name}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, currentTicketId }),
      })
    } catch (error) {
      console.error(`[${agentConfig.name}] Failed to update state:`, error)
    }
  }

  private async pollTicket(): Promise<Ticket | null> {
    const { serverUrl, agentConfig } = this.deps
    try {
      const res = await fetch(
        `${serverUrl}/tickets?assignee=${agentConfig.name}&status=ready`
      )
      if (!res.ok) {
        return null
      }
      const tickets: Ticket[] = await res.json()

      // 첫 번째 ticket 반환 (이미 priority, createdAt 순 정렬됨)
      return tickets[0] ?? null
    } catch (error) {
      console.error(`[${agentConfig.name}] Failed to poll tickets:`, error)
      return null
    }
  }

  private async processTicket(ticket: Ticket): Promise<void> {
    const { serverUrl, agentConfig, runClaude } = this.deps

    console.log(`[${agentConfig.name}] Processing ticket: ${ticket.id} (${ticket.title})`)

    try {
      // 1. 상태 업데이트: in_progress
      await this.updateState('working', ticket.id)
      const updatedTicket = await this.updateTicketStatus(ticket.id, 'in_progress', ticket.version)
      if (!updatedTicket) {
        console.error(`[${agentConfig.name}] Failed to update ticket to in_progress`)
        await this.updateState('idle')
        return
      }

      // 2. Ticket 타입에 따라 처리
      let result: RunClaudeResult

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

      // 5. 상태 복구: idle
      await this.updateState('idle')

      console.log(`[${agentConfig.name}] Ticket ${ticket.id} ${finalStatus}`)
    } catch (error) {
      console.error(`[${agentConfig.name}] Error processing ticket ${ticket.id}:`, error)
      await this.updateState('idle')
    }
  }

  private async processCcReview(ticket: Ticket): Promise<RunClaudeResult> {
    const { serverUrl, runClaude, agentConfig } = this.deps

    // 1. Parent ticket 조회
    let parent: Ticket | null = null
    try {
      const parentRes = await fetch(`${serverUrl}/tickets/${ticket.parentTicketId}`)
      if (parentRes.ok) {
        parent = await parentRes.json()
      }
    } catch (error) {
      console.error(`[${agentConfig.name}] Failed to fetch parent ticket:`, error)
    }

    if (!parent) {
      return { exitCode: 1, output: 'Failed to fetch parent ticket' }
    }

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
    const result = runClaude(reviewPrompt, agentConfig)

    // 4. 결과를 comment로 추가
    try {
      await fetch(`${serverUrl}/tickets/${ticket.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: agentConfig.name,
          content: result.output.trim(),
        }),
      })
    } catch (error) {
      console.error(`[${agentConfig.name}] Failed to add comment:`, error)
    }

    return result
  }

  private async processTask(ticket: Ticket): Promise<RunClaudeResult> {
    const { runClaude, agentConfig } = this.deps

    // merge ticket인지 확인 (review_approved 이벤트로 생성된 ticket)
    if (
      ticket.metadata?.github?.eventType === 'review_approved' &&
      ticket.metadata?.github?.prUrl
    ) {
      // MergeService로 처리
      const mergeResult = await this.mergeService.executeMerge(
        ticket.metadata.github.prUrl,
        agentConfig
      )

      if (mergeResult.success) {
        return {
          exitCode: 0,
          output: `PR merged successfully`,
        }
      } else if (mergeResult.conflicted) {
        // conflict_resolve ticket이 생성됨
        return {
          exitCode: 0, // ticket 생성 성공이므로 0
          output: `Conflict detected. Created conflict_resolve ticket.`,
        }
      } else {
        return {
          exitCode: 1,
          output: `Merge failed: ${mergeResult.error}`,
        }
      }
    }

    // 기존 로직: Claude 실행
    return runClaude(ticket.prompt, agentConfig)
  }

  private async updateTicketStatus(
    ticketId: string,
    status: string,
    expectedVersion: number,
    result?: { exitCode: number; logPath: string }
  ): Promise<Ticket | null> {
    const { serverUrl } = this.deps
    try {
      const res = await fetch(`${serverUrl}/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, expectedVersion, result }),
      })
      if (!res.ok) {
        return null
      }
      return await res.json()
    } catch (error) {
      console.error(`Failed to update ticket status:`, error)
      return null
    }
  }

  private async saveLog(ticketId: string, log: string): Promise<void> {
    const { serverUrl } = this.deps
    try {
      await fetch(`${serverUrl}/tickets/${ticketId}/log`, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body: log,
      })
    } catch (error) {
      console.error(`Failed to save log:`, error)
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
