# Phase 1: env-builder

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/spec.md`
- `/docs/architecture.md`
- `/docs/adr.md`
- `/docs/testing.md`
- `/docs/test-cases.md`
- `/tasks/6-gh-profile/docs-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물 및 기존 코드를 반드시 확인하라:

- `/src/types/index.ts` — 현재 타입 정의
- `/src/claude-runner/flag-builder.ts` — env-builder와 동일 레이어의 기존 모듈 (패턴 참고)
- `/src/claude-runner/spawner.ts` — env를 전달받을 모듈 (아직 수정하지 마라)
- `/tests/flag-builder.test.ts` — 기존 테스트 패턴 참고

## 작업 내용

### 1. `src/types/index.ts` — AgentConfig 타입 확장

`AgentConfig` 인터페이스에 `gh_user` optional 필드를 추가:

```typescript
export interface AgentConfig {
  name: string
  description: string
  gh_user?: string  // gh CLI에 등록된 GitHub 계정명
  subagents?: string[]
  skills?: string[]
  hooks?: string[]
}
```

### 2. `src/claude-runner/env-builder.ts` — 신규 모듈 생성

이 모듈은 두 레이어로 구성한다:

#### 2-1. 순수 변환 함수 (테스트 대상)

```typescript
export function buildEnvFromProfile(profile: { token: string; name: string; email: string }): Record<string, string>
```

- `GH_TOKEN`, `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME`, `GIT_COMMITTER_EMAIL` 5개 키를 가진 객체 반환
- 값이 빈 문자열이어도 그대로 포함 (필터링하지 않음)

#### 2-2. resolve 레이어 + 캐시 (외부 의존, 테스트 안 함)

```typescript
interface GhProfile {
  token: string
  name: string
  email: string
}

type ProfileResolver = (ghUser: string) => GhProfile

export function resolveGhProfile(ghUser: string): GhProfile
```

`resolveGhProfile`은 기본 resolver로:
1. `execSync('gh auth token --user ' + ghUser)`로 토큰 추출
2. 해당 토큰으로 `GH_TOKEN={token} gh api /user --jq '.name'`과 `GH_TOKEN={token} gh api /user --jq '.email'`로 name/email 추출 (또는 한 번의 호출로 둘 다 추출)
3. `{ token, name, email }` 반환
4. gh CLI 호출 실패 시 명확한 에러 메시지와 함께 throw (예: "gh auth token failed for user 'X'. 'gh auth login'으로 계정을 먼저 등록하세요.")

**execSync 호출 시 주의**: ghUser를 shell 인자로 전달할 때 injection 방지를 위해 반드시 배열 형태의 `execFileSync`를 사용하라. `execSync('gh auth token --user ' + ghUser)` 같은 문자열 연결 금지.

#### 2-3. 캐시 로직

모듈 스코프에 캐시 변수를 둔다:

```typescript
interface CachedProfile {
  ghUser: string
  profile: GhProfile
  expiresAt: number
}

let cache: CachedProfile | null = null
const CACHE_TTL_MS = 15 * 60 * 1000 // 15분
```

#### 2-4. 메인 export 함수

```typescript
export function buildEnv(
  ghUser?: string,
  options?: { resolver?: ProfileResolver }
): Record<string, string>
```

동작:
1. `ghUser`가 없으면 빈 객체 `{}` 반환
2. 캐시 확인: `cache`가 존재하고 `cache.ghUser === ghUser`이고 `Date.now() < cache.expiresAt`이면 캐시된 profile 사용
3. 캐시 미스: `options?.resolver ?? resolveGhProfile`을 호출하여 profile resolve
4. 캐시 저장: `{ ghUser, profile, expiresAt: Date.now() + CACHE_TTL_MS }`
5. `buildEnvFromProfile(profile)` 호출하여 env 객체 반환

`options.resolver`는 테스트에서 주입하기 위한 용도다. 프로덕션 코드에서는 생략한다.

### 3. `tests/env-builder.test.ts` — 유닛 테스트

아래 7개 테스트 케이스를 구현하라. 기존 `/tests/flag-builder.test.ts`의 패턴을 따르라.

```
[buildEnvFromProfile — 순수 변환]
✓ gh_user 없음 (undefined) → buildEnv(undefined) 호출 시 빈 객체 반환
✓ 정상 프로필 (token, name, email) → GH_TOKEN, GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL, GIT_COMMITTER_NAME, GIT_COMMITTER_EMAIL 모두 세팅
✓ name/email이 빈 문자열 → 빈 문자열 키도 포함

[캐시 로직 — resolver 주입]
✓ 캐시 미스 (첫 호출) → resolver 함수 1회 호출됨
✓ 캐시 히트 (동일 ghUser로 연속 호출) → resolver 함수 1회만 호출됨 (두 번째는 캐시)
✓ 캐시 만료 (Date.now를 mock하여 TTL 초과) → resolver 함수 2회 호출됨
✓ ghUser 변경 → resolver 함수 2회 호출됨 (첫 user + 새 user)
```

캐시 테스트 시 주의:
- 테스트 간 캐시 격리를 위해 각 테스트 전에 캐시를 초기화해야 한다. `clearCache()` 같은 헬퍼를 export하거나, 각 테스트에서 다른 ghUser를 사용하라.
- `Date.now` mock은 `vi.spyOn(Date, 'now')`로 처리.

## Acceptance Criteria

```bash
npm run build  # 컴파일 에러 없음
npm test       # 모든 테스트 통과 (기존 + 신규 env-builder 7개)
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/6-gh-profile/index.json`의 phase 1 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 이 phase에서는 `spawner.ts`, `run.service.ts`를 수정하지 마라. 다음 phase에서 한다.
- `execFileSync`를 사용하라. `execSync`로 문자열 연결하면 command injection 취약점이 된다.
- 캐시는 모듈 스코프 변수 하나로 구현하라. Map이나 별도 클래스 불필요.
- 기존 테스트를 깨뜨리지 마라.
