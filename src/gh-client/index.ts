import { spawnSync } from 'child_process'

/**
 * gh CLI 래퍼 인터페이스
 * 테스트 시 mock 주입 가능
 */
export interface IGhClient {
  /**
   * PR 정보 조회
   */
  getPrInfo(prUrl: string): Promise<PrInfo>

  /**
   * PR의 현재 review 상태 조회
   */
  getPrReviews(prUrl: string): Promise<PrReviewInfo[]>
}

export interface PrInfo {
  number: number
  title: string
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  baseRefName: string
  headRefName: string
  url: string
  author: {
    login: string
  }
  reviewRequests: {
    login: string
  }[]
}

export interface PrReviewInfo {
  author: {
    login: string
  }
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING'
}

/**
 * gh CLI 구현체
 */
export class GhClient implements IGhClient {
  constructor(private readonly ghUser?: string) {}

  private execGh(args: string[]): string {
    // gh_user가 있으면 해당 계정의 토큰 사용
    const env = this.ghUser
      ? { ...process.env, GH_TOKEN: this.getToken() }
      : process.env

    const fullArgs = this.ghUser ? [...args, '--hostname', 'github.com'] : args
    const result = spawnSync('gh', fullArgs, {
      encoding: 'utf-8',
      env,
    })

    if (result.error) throw result.error
    if (result.status !== 0) {
      throw new Error(result.stderr || 'gh command failed')
    }
    return result.stdout.trim()
  }

  private getToken(): string {
    if (!this.ghUser) return ''
    const result = spawnSync('gh', ['auth', 'token', '--user', this.ghUser], {
      encoding: 'utf-8',
    })
    if (result.error) throw result.error
    if (result.status !== 0) {
      throw new Error(result.stderr || 'gh auth token failed')
    }
    return result.stdout.trim()
  }

  async getPrInfo(prUrl: string): Promise<PrInfo> {
    try {
      const json = this.execGh([
        'pr', 'view', prUrl,
        '--json', 'number,title,state,baseRefName,headRefName,url,author,reviewRequests'
      ])
      return JSON.parse(json)
    } catch (error) {
      throw new Error(`Failed to get PR info for ${prUrl}: ${error}`)
    }
  }

  async getPrReviews(prUrl: string): Promise<PrReviewInfo[]> {
    try {
      const json = this.execGh(['pr', 'view', prUrl, '--json', 'reviews'])
      const data = JSON.parse(json)
      return data.reviews || []
    } catch (error) {
      throw new Error(`Failed to get PR reviews for ${prUrl}: ${error}`)
    }
  }
}
