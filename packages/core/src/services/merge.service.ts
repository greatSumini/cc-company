import { execSync, ExecSyncOptions } from 'child_process'
import type { IGhClient, PrInfo, AgentConfig, TicketMetadata } from '../types/index.js'

export interface MergeResult {
  success: boolean
  conflicted: boolean
  merged: boolean
  error?: string
}

export interface MergeServiceDeps {
  ghClient: IGhClient
  serverUrl: string
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
    const { ghClient, workingDir } = this.deps

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
   * conflict_resolve ticket 생성 via HTTP API
   */
  private async createConflictTicket(
    prUrl: string,
    prInfo: PrInfo,
    agentConfig: AgentConfig
  ): Promise<void> {
    const { serverUrl } = this.deps

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

    try {
      const response = await fetch(`${serverUrl}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `[Conflict] PR #${prInfo.number} - ${prInfo.baseRefName}와 충돌`,
          prompt,
          assignee: agentConfig.name,
          createdBy: 'system',
          metadata,
        }),
      })

      if (!response.ok) {
        console.error(`[MergeService] Failed to create conflict ticket: ${response.status}`)
        return
      }

      console.log(`[MergeService] Created conflict_resolve ticket for PR #${prInfo.number}`)
    } catch (error) {
      console.error(`[MergeService] Failed to create conflict ticket:`, error)
    }
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
