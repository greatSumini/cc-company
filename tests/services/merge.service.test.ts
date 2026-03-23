import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MergeService } from '../../src/services/merge.service.js'
import type { IGhClient, PrInfo } from '../../src/gh-client/index.js'

// execSync mock
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}))

import { execSync } from 'child_process'

// fetch mock
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('MergeService', () => {
  let service: MergeService
  let mockGhClient: IGhClient

  const mockPrInfo: PrInfo = {
    number: 42,
    title: 'feat: add new feature',
    state: 'OPEN',
    baseRefName: 'main',
    headRefName: 'feature/new-feature',
    url: 'https://github.com/test-org/test-repo/pull/42',
    author: { login: 'dev-bot' },
    reviewRequests: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 'ticket-1' }) })

    mockGhClient = {
      getPrInfo: vi.fn().mockResolvedValue(mockPrInfo),
      getPrReviews: vi.fn().mockResolvedValue([]),
    } as unknown as IGhClient

    service = new MergeService({
      ghClient: mockGhClient,
      serverUrl: 'http://localhost:3847',
      workingDir: '/tmp/test-repo',
    })
  })

  it('TC 5.1: merge 성공', async () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from(''))

    const result = await service.executeMerge(
      'https://github.com/test-org/test-repo/pull/42',
      { name: 'developer', description: 'test', gh_user: 'dev-bot' }
    )

    expect(result.success).toBe(true)
    expect(result.merged).toBe(true)
    expect(result.conflicted).toBe(false)
  })

  it('TC 5.2: conflict 발생', async () => {
    let callCount = 0
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      callCount++
      // checkout (1), fetch (2), rebase (3) - conflict, rebase --abort (4)
      if (callCount === 3 && cmd.includes('rebase origin/')) {
        throw new Error('CONFLICT (content): Merge conflict in file.ts')
      }
      return Buffer.from('')
    })

    const result = await service.executeMerge(
      'https://github.com/test-org/test-repo/pull/42',
      { name: 'developer', description: 'test', gh_user: 'dev-bot' }
    )

    expect(result.success).toBe(false)
    expect(result.conflicted).toBe(true)
    // conflict ticket 생성 API 호출 확인
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3847/tickets',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('[Conflict]'),
      })
    )
  })

  it('TC 5.3: gh pr merge 실패', async () => {
    let callCount = 0
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      callCount++
      // checkout (1), fetch (2), rebase (3), push (4), gh pr merge (5) - fail
      if (callCount === 5 && cmd.includes('gh pr merge')) {
        throw new Error('GraphQL: Pull request is not mergeable')
      }
      return Buffer.from('')
    })

    const result = await service.executeMerge(
      'https://github.com/test-org/test-repo/pull/42',
      { name: 'developer', description: 'test', gh_user: 'dev-bot' }
    )

    expect(result.success).toBe(false)
    expect(result.merged).toBe(false)
    expect(result.error).toContain('gh pr merge failed')
  })

  it('TC 5.4: PR 정보 조회 실패', async () => {
    vi.mocked(mockGhClient.getPrInfo).mockRejectedValue(new Error('Not found'))

    const result = await service.executeMerge(
      'https://github.com/test-org/test-repo/pull/999',
      { name: 'developer', description: 'test', gh_user: 'dev-bot' }
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('Not found')
  })

  it('TC 5.5: PR 상태가 OPEN이 아님', async () => {
    vi.mocked(mockGhClient.getPrInfo).mockResolvedValue({
      ...mockPrInfo,
      state: 'MERGED',
    })

    const result = await service.executeMerge(
      'https://github.com/test-org/test-repo/pull/42',
      { name: 'developer', description: 'test', gh_user: 'dev-bot' }
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('PR is not open')
  })
})
