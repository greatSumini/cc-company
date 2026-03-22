# Phase 0: docs-adr

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/spec.md`
- `/docs/architecture.md`
- `/docs/adr.md`
- `/docs/test-cases.md`
- `/docs/testing.md`

## 작업 내용

에이전트별 GitHub 프로필 분리 기능을 위한 문서 업데이트를 수행한다.

### 1. `docs/adr.md` — ADR-016 추가

파일 끝에 아래 ADR을 추가:

```
## ADR-016: 에이전트별 GitHub 프로필 — gh CLI 멀티 계정 + 환경변수 주입

**상태**: 확정 (2026-03-22)

**맥락**: cc-company로 생성한 agent들이 commit/push/PR 시 서로 다른 GitHub 계정을 사용할 수 있어야 한다. GitHub에서 "누가 했는가"는 두 레이어로 나뉜다: Git commit identity (author/committer)와 GitHub API identity (push/PR 권한). 둘 다 에이전트별로 분리해야 한다.

**결정**: gh CLI 멀티 계정 + 환경변수 주입

**근거**:
- gh CLI v2.40+는 네이티브 멀티 계정을 지원 (`gh auth login`으로 복수 계정 등록, `gh auth token --user X`로 토큰 추출)
- `GH_TOKEN` 환경변수로 subprocess 단위 GitHub API 격리 가능 (병렬 실행 안전)
- `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME`, `GIT_COMMITTER_EMAIL` 환경변수로 Git identity 격리
- 별도 credential store나 SSH 키 관리 불필요 — gh CLI의 기존 인프라 활용
- agent.json에 `gh_user` 필드만 추가하면 되므로 스키마 변경 최소
- 프로필 정보(name, email)는 `gh api /user`로 동적 resolve하여 DRY 유지
- 15분 in-memory 캐시로 반복 호출 절감

**구현 위치**:
- `src/claude-runner/env-builder.ts` (신규) — gh_user → env 변환 전담
- `src/claude-runner/spawner.ts` — env 파라미터 추가
- `src/services/run.service.ts` — env-builder 호출 → spawner 전달
- `scripts/run-phases.py` — task index.json의 gh_user 필드 기반 동일 로직
```

### 2. `docs/spec.md` — agent.json 스키마 업데이트

`agent.json 스키마` 섹션의 JSON 예시와 설명을 업데이트:

**기존 JSON 예시**에 `"gh_user"` 필드를 추가:
```json
{
  "name": "developer",
  "description": "소프트웨어 개발 전담 에이전트",
  "gh_user": "dev-bot",
  "subagents": ["git-expert", "code-reviewer"],
  "skills": ["deploy"],
  "hooks": ["pre-commit"]
}
```

그리고 기존 설명 아래에 다음을 추가:
```
- `gh_user`: optional. gh CLI에 등록된 GitHub 계정명. 설정 시 해당 계정의 토큰과 Git identity로 commit/push/PR 수행. 미설정 시 현재 활성 계정 사용.
```

### 3. `docs/architecture.md` — env-builder 모듈 + 데이터 흐름 반영

#### 3-1. Claude Runner 섹션 업데이트

기존 Claude Runner 설명:
```
- **flag-builder.ts** — AgentConfig → claude CLI 플래그 배열 변환
- **spawner.ts** — child_process.spawn + stdin/stdout/stderr 파이프 + 종료코드 전달
```

이 두 줄 사이에 env-builder를 추가:
```
- **flag-builder.ts** — AgentConfig → claude CLI 플래그 배열 변환
- **env-builder.ts** — AgentConfig.gh_user → 환경변수 객체 변환 (GH_TOKEN, GIT_AUTHOR_*, GIT_COMMITTER_*). gh CLI로 토큰/identity resolve. 15분 in-memory 캐시.
- **spawner.ts** — child_process.spawn + env 주입 + stdin/stdout/stderr 파이프 + 종료코드 전달
```

#### 3-2. 소스 디렉토리 구조 업데이트

`claude-runner/` 하위에 `env-builder.ts`를 추가:
```
├── claude-runner/
│   ├── flag-builder.ts
│   ├── env-builder.ts
│   └── spawner.ts
```

#### 3-3. 데이터 흐름 업데이트

두 개의 데이터 흐름 예시(Interactive Mode, Interactive Mode with Prompt) 모두에서, step 2와 step 4 사이에 env-builder 단계를 추가한다.

기존 step 번호를 조정하여 다음과 같이 반영:

```
2. services/run.service.ts
   ...기존 내용...
        │
        ▼
3. claude-runner/env-builder.ts
   agent.gh_user → gh auth token → gh api /user → env 객체
   gh_user 미설정 시 빈 env (시스템 기본값 사용)
        │
        ▼
4. claude-runner/flag-builder.ts
   ...기존 내용...
        │
        ▼
5. claude-runner/spawner.ts
   child_process.spawn("claude", flags, { env: { ...process.env, ...ghEnv } })
   ...기존 내용...
        │
        ▼
6. logger/run-logger.ts
   ...기존 내용...
```

### 4. `docs/test-cases.md` — env-builder 테스트 케이스 추가

파일 끝에 다음 섹션을 추가:

```
## env-builder (유닛, ~7개)

[buildEnvFromProfile — 순수 변환]
✓ gh_user 없음 (undefined) → 빈 객체 반환
✓ 정상 프로필 (token, name, email) → GH_TOKEN, GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL, GIT_COMMITTER_NAME, GIT_COMMITTER_EMAIL 모두 세팅
✓ name/email이 빈 문자열 → 빈 문자열 키도 포함 (필터링하지 않음)

[캐시 로직 — resolver 주입]
✓ 캐시 미스 (첫 호출) → resolver 함수 1회 실행
✓ 캐시 히트 (동일 ghUser, TTL 내) → resolver 함수 미실행, 캐시된 값 반환
✓ 캐시 만료 (TTL 초과) → resolver 함수 재실행
✓ ghUser 변경 → 이전 캐시 무효화, 새 resolver 실행
```

## Acceptance Criteria

```bash
npm run build  # 컴파일 에러 없음
npm test       # 기존 테스트 모두 통과
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/6-gh-profile/index.json`의 phase 0 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 문서만 수정하라. 코드는 절대 건드리지 마라.
- 기존 문서의 다른 부분을 변경하지 마라. 추가/수정 지시된 부분만 정확히 반영하라.
- ADR 번호가 기존과 충돌하지 않는지 확인하라 (현재 마지막: ADR-015).
