# Phase 2: spawner-integration

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/spec.md`
- `/docs/architecture.md`
- `/docs/adr.md`
- `/tasks/6-gh-profile/docs-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/src/types/index.ts` — Phase 1에서 `gh_user` 필드가 추가된 `AgentConfig`
- `/src/claude-runner/env-builder.ts` — Phase 1에서 생성된 모듈
- `/src/claude-runner/spawner.ts` — 이번 phase에서 수정할 대상
- `/src/services/run.service.ts` — 이번 phase에서 수정할 대상

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업 내용

### 1. `src/claude-runner/spawner.ts` — env 파라미터 추가

`spawnClaude` 함수 시그니처를 확장:

```typescript
export function spawnClaude(flags: string[], env?: Record<string, string>): SpawnResult
```

변경 내용:
- 두 번째 파라미터 `env`를 optional로 추가
- `spawnSync` 호출 시 `env` 옵션에 `{ ...process.env, ...env }` 전달
- `env`가 undefined이거나 빈 객체이면 기존 동작과 동일 (`process.env`만 사용)
- dry-run 모드에서도 env가 있으면 주입된 환경변수 키 목록을 출력 (디버깅용):
  ```
  [DRY-RUN] claude --append-system-prompt-file ...
  [DRY-RUN] env: GH_TOKEN, GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL, GIT_COMMITTER_NAME, GIT_COMMITTER_EMAIL
  ```
- `stdio: 'inherit'`는 유지

### 2. `src/services/run.service.ts` — env-builder 연동

`run` 메서드에서 `buildEnv`를 호출하여 env 객체를 구성하고, `spawnClaude`에 전달:

변경 지점 (step 5와 step 6 사이):

```typescript
import { buildEnv } from '../claude-runner/env-builder.js'

// ... 기존 코드 ...

// 5.5. buildEnv 호출
const env = buildEnv(agent.gh_user)

// 6. spawnClaude 호출
const result = spawnClaude(flags, env)
```

`buildEnv`는 `gh_user`가 없으면 빈 객체를 반환하므로, 기존 동작에 영향 없다. 별도 분기 처리 불필요.

## Acceptance Criteria

```bash
npm run build  # 컴파일 에러 없음
npm test       # 모든 테스트 통과 (기존 + env-builder)
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/6-gh-profile/index.json`의 phase 2 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- `spawner.ts`의 `spawnSync` 호출에서 `env` 옵션을 넘길 때, 반드시 `...process.env`를 spread하라. 그렇지 않으면 PATH 등 기본 환경변수가 사라져 claude CLI를 찾지 못한다.
- `run.service.ts`에서 `buildEnv`의 두 번째 인자 (`options.resolver`)는 전달하지 마라. 프로덕션에서는 기본 resolver를 사용한다.
- 기존 테스트를 깨뜨리지 마라. spawner 테스트는 없으므로 새 테스트 작성 불필요.
- `env-builder.ts`의 import 경로가 `.js` 확장자를 포함하는지 확인하라 (ESM 호환).
