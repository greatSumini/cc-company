import { execFileSync } from 'child_process'

export interface GhProfile {
  token: string
  name: string
  email: string
}

export type ProfileResolver = (ghUser: string) => GhProfile

interface CachedProfile {
  ghUser: string
  profile: GhProfile
  expiresAt: number
}

let cache: CachedProfile | null = null
const CACHE_TTL_MS = 15 * 60 * 1000 // 15분

/**
 * 캐시를 초기화한다. 테스트에서 사용.
 */
export function clearCache(): void {
  cache = null
}

/**
 * 순수 변환 함수: GhProfile → 환경변수 객체
 */
export function buildEnvFromProfile(profile: {
  token: string
  name: string
  email: string
}): Record<string, string> {
  return {
    GH_TOKEN: profile.token,
    GIT_AUTHOR_NAME: profile.name,
    GIT_AUTHOR_EMAIL: profile.email,
    GIT_COMMITTER_NAME: profile.name,
    GIT_COMMITTER_EMAIL: profile.email,
  }
}

/**
 * gh CLI를 통해 GitHub 프로필 정보를 resolve한다.
 * 기본 resolver로 사용된다.
 */
export function resolveGhProfile(ghUser: string): GhProfile {
  // 1. gh auth token 추출
  let token: string
  try {
    token = execFileSync('gh', ['auth', 'token', '--user', ghUser], {
      encoding: 'utf-8',
    }).trim()
  } catch {
    throw new Error(
      `gh auth token failed for user '${ghUser}'. 'gh auth login'으로 계정을 먼저 등록하세요.`
    )
  }

  // 2. GH_TOKEN 환경변수로 gh api /user 호출하여 name, email 추출
  let name: string
  let email: string
  try {
    const userJson = execFileSync('gh', ['api', '/user'], {
      encoding: 'utf-8',
      env: { ...process.env, GH_TOKEN: token },
    })
    const user = JSON.parse(userJson)
    name = user.name ?? ''
    email = user.email ?? ''
  } catch {
    throw new Error(
      `gh api /user failed for user '${ghUser}'. GitHub API 호출에 실패했습니다.`
    )
  }

  return { token, name, email }
}

/**
 * ghUser가 있으면 환경변수 객체를 반환하고, 없으면 빈 객체를 반환한다.
 * 15분 캐시를 적용한다.
 */
export function buildEnv(
  ghUser?: string,
  options?: { resolver?: ProfileResolver }
): Record<string, string> {
  if (!ghUser) {
    return {}
  }

  const now = Date.now()

  // 캐시 확인
  if (cache && cache.ghUser === ghUser && now < cache.expiresAt) {
    return buildEnvFromProfile(cache.profile)
  }

  // 캐시 미스: resolver 호출
  const resolver = options?.resolver ?? resolveGhProfile
  const profile = resolver(ghUser)

  // 캐시 저장
  cache = {
    ghUser,
    profile,
    expiresAt: now + CACHE_TTL_MS,
  }

  return buildEnvFromProfile(profile)
}
