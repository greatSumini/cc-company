import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  buildEnv,
  buildEnvFromProfile,
  clearCache,
  type GhProfile,
} from '../../src/claude-runner/env-builder.js'

describe('env-builder', () => {
  beforeEach(() => {
    clearCache()
    vi.restoreAllMocks()
  })

  describe('[buildEnvFromProfile — 순수 변환]', () => {
    it('gh_user 없음 (undefined) → buildEnv(undefined) 호출 시 빈 객체 반환', () => {
      const env = buildEnv(undefined)
      expect(env).toEqual({})
    })

    it('정상 프로필 (token, name, email) → GH_TOKEN, GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL, GIT_COMMITTER_NAME, GIT_COMMITTER_EMAIL 모두 세팅', () => {
      const profile: GhProfile = {
        token: 'gho_test_token_123',
        name: 'Test User',
        email: 'test@example.com',
      }

      const env = buildEnvFromProfile(profile)

      expect(env).toEqual({
        GH_TOKEN: 'gho_test_token_123',
        GIT_AUTHOR_NAME: 'Test User',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Test User',
        GIT_COMMITTER_EMAIL: 'test@example.com',
      })
    })

    it('name/email이 빈 문자열 → 빈 문자열 키도 포함', () => {
      const profile: GhProfile = {
        token: 'gho_token',
        name: '',
        email: '',
      }

      const env = buildEnvFromProfile(profile)

      expect(env).toEqual({
        GH_TOKEN: 'gho_token',
        GIT_AUTHOR_NAME: '',
        GIT_AUTHOR_EMAIL: '',
        GIT_COMMITTER_NAME: '',
        GIT_COMMITTER_EMAIL: '',
      })
    })
  })

  describe('[캐시 로직 — resolver 주입]', () => {
    it('캐시 미스 (첫 호출) → resolver 함수 1회 호출됨', () => {
      const mockResolver = vi.fn().mockReturnValue({
        token: 'token1',
        name: 'User1',
        email: 'user1@test.com',
      })

      buildEnv('user-a', { resolver: mockResolver })

      expect(mockResolver).toHaveBeenCalledTimes(1)
      expect(mockResolver).toHaveBeenCalledWith('user-a')
    })

    it('캐시 히트 (동일 ghUser로 연속 호출) → resolver 함수 1회만 호출됨 (두 번째는 캐시)', () => {
      const mockResolver = vi.fn().mockReturnValue({
        token: 'token2',
        name: 'User2',
        email: 'user2@test.com',
      })

      // 첫 번째 호출
      const env1 = buildEnv('user-b', { resolver: mockResolver })
      // 두 번째 호출 (캐시 히트)
      const env2 = buildEnv('user-b', { resolver: mockResolver })

      expect(mockResolver).toHaveBeenCalledTimes(1)
      expect(env1).toEqual(env2)
    })

    it('캐시 만료 (Date.now를 mock하여 TTL 초과) → resolver 함수 2회 호출됨', () => {
      const mockResolver = vi.fn().mockReturnValue({
        token: 'token3',
        name: 'User3',
        email: 'user3@test.com',
      })

      const originalNow = Date.now()
      const dateNowSpy = vi.spyOn(Date, 'now')

      // 첫 번째 호출: 현재 시간
      dateNowSpy.mockReturnValue(originalNow)
      buildEnv('user-c', { resolver: mockResolver })
      expect(mockResolver).toHaveBeenCalledTimes(1)

      // 두 번째 호출: TTL 내 (캐시 히트)
      dateNowSpy.mockReturnValue(originalNow + 10 * 60 * 1000) // 10분 후
      buildEnv('user-c', { resolver: mockResolver })
      expect(mockResolver).toHaveBeenCalledTimes(1)

      // 세 번째 호출: TTL 초과 (캐시 미스)
      dateNowSpy.mockReturnValue(originalNow + 16 * 60 * 1000) // 16분 후
      buildEnv('user-c', { resolver: mockResolver })
      expect(mockResolver).toHaveBeenCalledTimes(2)
    })

    it('ghUser 변경 → resolver 함수 2회 호출됨 (첫 user + 새 user)', () => {
      const mockResolver = vi.fn().mockReturnValue({
        token: 'token4',
        name: 'User4',
        email: 'user4@test.com',
      })

      // 첫 번째 user
      buildEnv('user-d', { resolver: mockResolver })
      expect(mockResolver).toHaveBeenCalledTimes(1)
      expect(mockResolver).toHaveBeenLastCalledWith('user-d')

      // 다른 user로 호출 (캐시 무효화)
      buildEnv('user-e', { resolver: mockResolver })
      expect(mockResolver).toHaveBeenCalledTimes(2)
      expect(mockResolver).toHaveBeenLastCalledWith('user-e')
    })
  })
})
