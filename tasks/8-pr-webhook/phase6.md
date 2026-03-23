# Phase 6: merge-logic

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/spec.md`
- `/spec/architecture.md`
- `/spec/adr.md`
- `/tasks/8-pr-webhook/spec-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/src/types/index.ts` (TicketMetadata, GithubEventType)
- `/src/gh-client/index.ts` (IGhClient, GhClient)
- `/src/services/agent-runner.service.ts` (기존 agent runner)
- `/src/services/ticket.service.ts` (TicketService)

## 작업 내용

### 1. `/src/services/merge.service.ts` 생성

PR merge 실행 및 conflict 처리:

```typescript
import { execSync, ExecSyncOptions } from 'child_process'
import type { IGhClient } from '../gh-client/index.js'
import type { TicketService } from './ticket.service.js'
import type { AgentConfig, TicketMetadata } from '../types/index.js'

export interface MergeResult {
  success: boolean
  conflicted: boolean
  merged: boolean
  error?: string
}

export interface MergeServiceDeps {
  ghClient: IGhClient
  ticketService: TicketService
  workingDir: string
}

export class MergeService {
  constructor(private readonly deps: MergeServiceDeps) {}

  /**
   * PR merge 실행
   *
   * 1. PR 정보 조회
   * 2. base branch와 rebase 시도
   * 3. 성공 시 gh pr merge 실행
   * 4. conflict 발생 시 rollback + conflict_resolve ticket 생성
   */
  async executeMerge(
    prUrl: string,
    agentConfig: AgentConfig
  ): Promise<MergeResult> {
    const { ghClient, ticketService, workingDir } = this.deps

    try {
      // 1. PR 정보 조회
      const prInfo = await ghClient.getPrInfo(prUrl)

      if (prInfo.state !== 'OPEN') {
        return {
          success: false,
          conflicted: false,
          merged: false,
          error: `PR is not open (state: ${prInfo.state})`,
        }
      }

      const baseBranch = prInfo.baseRefName
      const headBranch = prInfo.headRefName

      // 2. 현재 브랜치 확인 및 head branch로 체크아웃
      this.execGit(`checkout ${headBranch}`, workingDir)

      // 3. base branch fetch 및 rebase 시도
      this.execGit(`fetch origin ${baseBranch}`, workingDir)

      const rebaseResult = this.tryRebase(baseBranch, workingDir)

      if (!rebaseResult.success) {
        // Conflict 발생
        // rebase abort
        this.execGitSafe(`rebase --abort`, workingDir)

        // conflict_resolve ticket 생성
        await this.createConflictTicket(prUrl, prInfo, agentConfig)

        return {
          success: false,
          conflicted: true,
          merged: false,
          error: 'Conflict detected during rebase',
        }
      }

      // 4. force push (rebase 후)
      this.execGit(`push --force-with-lease origin ${headBranch}`, workingDir)

      // 5. gh pr merge 실행
      const mergeOutput = this.execGhSafe(`pr merge ${prUrl} --auto --merge`, workingDir)

      if (!mergeOutput.success) {
        return {
          success: false,
          conflicted: false,
          merged: false,
          error: `gh pr merge failed: ${mergeOutput.error}`,
        }
      }

      return {
        success: true,
        conflicted: false,
        merged: true,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        success: false,
        conflicted: false,
        merged: false,
        error: message,
      }
    }
  }

  /**
   * rebase 시도
   */
  private tryRebase(
    baseBranch: string,
    workingDir: string
  ): { success: boolean; error?: string } {
    try {
      this.execGit(`rebase origin/${baseBranch}`, workingDir)
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // conflict 여부 확인
      if (
        message.includes('CONFLICT') ||
        message.includes('could not apply') ||
        message.includes('Resolve all conflicts')
      ) {
        return { success: false, error: 'Conflict detected' }
      }
      return { success: false, error: message }
    }
  }

  /**
   * conflict_resolve ticket 생성
   */
  private async createConflictTicket(
    prUrl: string,
    prInfo: { number: number; title: string; baseRefName: string; headRefName: string },
    agentConfig: AgentConfig
  ): Promise<void> {
    const { ticketService } = this.deps

    // repo 추출 (prUrl에서)
    // https://github.com/owner/repo/pull/123 -> owner/repo
    const urlParts = prUrl.split('/')
    const repo = `${urlParts[3]}/${urlParts[4]}`

    const prompt = `PR #${prInfo.number}에서 ${prInfo.baseRefName} branch와 conflict가 발생했습니다.
Conflict를 해결하고 merge를 완료하세요.

## PR 정보
- **Title**: ${prInfo.title}
- **URL**: ${prUrl}
- **Branch**: ${prInfo.headRefName} → ${prInfo.baseRefName}

## 해결 방법

1. 먼저 conflict 상태를 확인하세요:
   \`\`\`bash
   git fetch origin ${prInfo.baseRefName}
   git checkout ${prInfo.headRefName}
   git rebase origin/${prInfo.baseRefName}
   \`\`\`

2. Conflict가 발생한 파일들을 수정하세요.

3. 수정 후:
   \`\`\`bash
   git add .
   git rebase --continue
   \`\`\`

4. 모든 conflict 해결 후 push:
   \`\`\`bash
   git push --force-with-lease origin ${prInfo.headRefName}
   \`\`\`

5. 마지막으로 merge:
   \`\`\`bash
   gh pr merge ${prUrl} --auto --merge
   \`\`\`
`

    const metadata: TicketMetadata = {
      source: 'webhook',
      github: {
        repo,
        prNumber: prInfo.number,
        prUrl,
        eventType: 'conflict_resolve',
      },
    }

    await ticketService.createTicket({
      title: `[Conflict] PR #${prInfo.number} - ${prInfo.baseRefName}와 충돌`,
      prompt,
      assignee: agentConfig.name,
      createdBy: 'system',
      metadata,
    })

    console.log(`[MergeService] Created conflict_resolve ticket for PR #${prInfo.number}`)
  }

  private execGit(args: string, cwd: string): string {
    const options: ExecSyncOptions = { cwd, encoding: 'utf-8' }
    return execSync(`git ${args}`, options).toString().trim()
  }

  private execGitSafe(args: string, cwd: string): { success: boolean; output?: string; error?: string } {
    try {
      const output = this.execGit(args, cwd)
      return { success: true, output }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message }
    }
  }

  private execGhSafe(args: string, cwd: string): { success: boolean; output?: string; error?: string } {
    try {
      const options: ExecSyncOptions = { cwd, encoding: 'utf-8' }
      const output = execSync(`gh ${args}`, options).toString().trim()
      return { success: true, output }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message }
    }
  }
}
```

### 2. Agent Runner에서 merge ticket 처리

`/src/services/agent-runner.service.ts` 수정:

기존 `processTask` 메서드에서 merge ticket을 감지하고 MergeService를 호출하도록 수정:

```typescript
import { MergeService } from './merge.service.js'
import { GhClient } from '../gh-client/index.js'

export interface AgentRunnerDeps {
  // ... 기존 필드들 ...
  ticketService: TicketService  // 추가
  workingDir: string            // 추가
}

export class AgentRunnerService {
  private mergeService: MergeService | null = null

  constructor(private deps: AgentRunnerDeps) {
    // MergeService 초기화
    if (deps.ticketService && deps.workingDir) {
      this.mergeService = new MergeService({
        ghClient: new GhClient(deps.agentConfig.gh_user),
        ticketService: deps.ticketService,
        workingDir: deps.workingDir,
      })
    }
    // ... 기존 코드 ...
  }

  private async processTask(ticket: Ticket): Promise<RunClaudeResult> {
    const { runClaude, agentConfig } = this.deps

    // merge ticket인지 확인
    if (
      ticket.metadata?.github?.eventType === 'review_approved' &&
      ticket.metadata?.github?.prUrl &&
      this.mergeService
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
          exitCode: 0,  // ticket 생성 성공이므로 0
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
}
```

### 3. Orchestrator에서 workingDir, ticketService 전달

`/src/services/orchestrator.service.ts`에서 agent worker에 추가 deps 전달:

```typescript
// agent worker spawn 시
const workerDeps: AgentRunnerDeps = {
  serverUrl: `http://localhost:${serverConfig.port}`,
  config: serverConfig,
  agentConfig: agent,
  runClaude: this.createClaudeRunner(agent),
  ticketService: this.ticketService,  // 추가
  workingDir: process.cwd(),          // 추가
}
```

**주의**: agent-worker가 별도 프로세스(fork)로 실행되므로, ticketService를 직접 전달할 수 없다. 대신:

**Option A**: HTTP API로 ticketService 호출 (이미 /tickets API 존재)
**Option B**: agent-worker 내에서 TicketService 인스턴스 생성

**권장: Option A** - 이미 Ticket Server가 있으므로 HTTP API 사용.

```typescript
// agent-runner.service.ts에서 ticketService 대신 HTTP 호출
private async createConflictTicketViaApi(
  prUrl: string,
  prInfo: PrInfo,
  agentConfig: AgentConfig
): Promise<void> {
  const { serverUrl } = this.deps

  const metadata = { /* ... */ }

  await fetch(`${serverUrl}/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `[Conflict] PR #${prInfo.number}`,
      prompt: '...',
      assignee: agentConfig.name,
      createdBy: 'system',
      metadata,
    }),
  })
}
```

MergeService를 agent-runner 내부에서 사용하고, ticket 생성은 HTTP API로 수행하도록 수정하라.

## Acceptance Criteria

```bash
npm run build  # 컴파일 에러 없음
npm test       # 모든 테스트 통과
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/8-pr-webhook/index.json`의 phase 6 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- git 명령어 실행 시 working directory를 정확히 지정하라.
- rebase 실패 시 반드시 `git rebase --abort`로 롤백하라.
- `--force-with-lease`를 사용하여 다른 사람의 변경을 덮어쓰지 않도록 하라.
- merge ticket이 아닌 일반 task ticket은 기존대로 Claude를 실행하라.
- agent-worker가 fork 프로세스이므로, ticketService 직접 전달 대신 HTTP API를 사용하라.
- 기존 테스트를 깨뜨리지 마라.
