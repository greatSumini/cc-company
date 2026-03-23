# spec-diff: gh-profile

Baseline: `732cc99`

## `docs/adr.md`

```diff
diff --git a/spec/adr.md b/spec/adr.md
index bfa380c..63b5a53 100644
--- a/spec/adr.md
+++ b/spec/adr.md
@@ -223,3 +223,28 @@
 - 정수 ID는 삭제 후에도 기존 항목의 ID가 변하지 않아 안정적 참조 가능
 - UUID/해시는 이 규모에서 과잉. 파일 내 유니크면 충분
 - 새 항목 추가 시 `max(id) + 1`로 부여. AI가 파일을 읽고 직접 할당
+
+---
+
+## ADR-016: 에이전트별 GitHub 프로필 — gh CLI 멀티 계정 + 환경변수 주입
+
+**상태**: 확정 (2026-03-22)
+
+**맥락**: cc-company로 생성한 agent들이 commit/push/PR 시 서로 다른 GitHub 계정을 사용할 수 있어야 한다. GitHub에서 "누가 했는가"는 두 레이어로 나뉜다: Git commit identity (author/committer)와 GitHub API identity (push/PR 권한). 둘 다 에이전트별로 분리해야 한다.
+
+**결정**: gh CLI 멀티 계정 + 환경변수 주입
+
+**근거**:
+- gh CLI v2.40+는 네이티브 멀티 계정을 지원 (`gh auth login`으로 복수 계정 등록, `gh auth token --user X`로 토큰 추출)
+- `GH_TOKEN` 환경변수로 subprocess 단위 GitHub API 격리 가능 (병렬 실행 안전)
+- `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME`, `GIT_COMMITTER_EMAIL` 환경변수로 Git identity 격리
+- 별도 credential store나 SSH 키 관리 불필요 — gh CLI의 기존 인프라 활용
+- agent.json에 `gh_user` 필드만 추가하면 되므로 스키마 변경 최소
+- 프로필 정보(name, email)는 `gh api /user`로 동적 resolve하여 DRY 유지
+- 15분 in-memory 캐시로 반복 호출 절감
+
+**구현 위치**:
+- `src/claude-runner/env-builder.ts` (신규) — gh_user → env 변환 전담
+- `src/claude-runner/spawner.ts` — env 파라미터 추가
+- `src/services/run.service.ts` — env-builder 호출 → spawner 전달
+- `scripts/run-phases.py` — task index.json의 gh_user 필드 기반 동일 로직
```

## `docs/architecture.md`

```diff
diff --git a/spec/architecture.md b/spec/architecture.md
index b44f9be..6295dff 100644
--- a/spec/architecture.md
+++ b/spec/architecture.md
@@ -67,7 +67,8 @@ interface IStore {
 Claude CLI와의 인터페이스 전담.
 
 - **flag-builder.ts** — AgentConfig → claude CLI 플래그 배열 변환
-- **spawner.ts** — child_process.spawn + stdin/stdout/stderr 파이프 + 종료코드 전달
+- **env-builder.ts** — AgentConfig.gh_user → 환경변수 객체 변환 (GH_TOKEN, GIT_AUTHOR_*, GIT_COMMITTER_*). gh CLI로 토큰/identity resolve. 15분 in-memory 캐시.
+- **spawner.ts** — child_process.spawn + env 주입 + stdin/stdout/stderr 파이프 + 종료코드 전달
 
 ### Logger
 
@@ -94,6 +95,7 @@ src/
 │   └── fs-store.ts
 ├── claude-runner/
 │   ├── flag-builder.ts
+│   ├── env-builder.ts
 │   └── spawner.ts
 ├── logger/
 │   └── run-logger.ts
@@ -121,19 +123,24 @@ src/
    mode="interactive" 전달
         │
         ▼
-3. claude-runner/flag-builder.ts
+3. claude-runner/env-builder.ts
+   agent.gh_user → gh auth token → gh api /user → env 객체
+   gh_user 미설정 시 빈 env (시스템 기본값 사용)
+        │
+        ▼
+4. claude-runner/flag-builder.ts
    AgentConfig + SubagentConfig[] → claude CLI 플래그 배열
    prompt가 undefined이면 마지막 positional arg 생략
    ["--append-system-prompt-file", "...prompt.md",
     "--agents", '{"git-expert":{...}}']
         │
         ▼
-4. claude-runner/spawner.ts
-   child_process.spawn("claude", flags)
+5. claude-runner/spawner.ts
+   child_process.spawn("claude", flags, { env: { ...process.env, ...ghEnv } })
    stdio: 'inherit' → interactive TUI가 터미널에 표시됨
         │
         ▼
-5. logger/run-logger.ts
+6. logger/run-logger.ts
    RunLog JSON → .cc-company/runs/{timestamp}-{uuid}.json
    prompt: null, mode: "interactive"
 ```
@@ -154,7 +161,12 @@ src/
    store.getSkills(config.skills) → SkillConfig[]
         │
         ▼
-3. claude-runner/flag-builder.ts
+3. claude-runner/env-builder.ts
+   agent.gh_user → gh auth token → gh api /user → env 객체
+   gh_user 미설정 시 빈 env (시스템 기본값 사용)
+        │
+        ▼
+4. claude-runner/flag-builder.ts
    AgentConfig + SubagentConfig[] → claude CLI 플래그 배열
    prompt가 있으면 마지막 positional arg로 포함
    ["--append-system-prompt-file", "...prompt.md",
@@ -163,12 +175,12 @@ src/
     "버그 고쳐줘"]
         │
         ▼
-4. claude-runner/spawner.ts
-   child_process.spawn("claude", flags)
+5. claude-runner/spawner.ts
+   child_process.spawn("claude", flags, { env: { ...process.env, ...ghEnv } })
    stdout/stderr → 사용자에게 파이프 + 버퍼에 수집
         │
         ▼
-5. logger/run-logger.ts
+6. logger/run-logger.ts
    RunLog JSON → .cc-company/runs/{timestamp}-{uuid}.json
    prompt: "버그 고쳐줘", mode: "interactive"
 ```
```

## `docs/spec.md`

```diff
diff --git a/spec/spec.md b/spec/spec.md
index b51d2c3..0b5abd0 100644
--- a/spec/spec.md
+++ b/spec/spec.md
@@ -99,6 +99,7 @@ cc-company hook add|list|remove <name>
 {
   "name": "developer",
   "description": "소프트웨어 개발 전담 에이전트",
+  "gh_user": "dev-bot",
   "subagents": ["git-expert", "code-reviewer"],
   "skills": ["deploy"],
   "hooks": ["pre-commit"]
@@ -107,6 +108,7 @@ cc-company hook add|list|remove <name>
 
 - 모든 리소스 필드는 optional
 - 값은 공용 풀의 리소스 이름(식별자) 배열
+- `gh_user`: optional. gh CLI에 등록된 GitHub 계정명. 설정 시 해당 계정의 토큰과 Git identity로 commit/push/PR 수행. 미설정 시 현재 활성 계정 사용.
 
 ## Subagent MD 형식
 
```

## `docs/test-cases.md`

```diff
diff --git a/spec/test-cases.md b/spec/test-cases.md
index 6b3b2bd..30f0e74 100644
--- a/spec/test-cases.md
+++ b/spec/test-cases.md
@@ -144,3 +144,18 @@ store는 in-memory fake 또는 실제 fs-store + 임시 디렉토리.
 ✓ resources 있는 SkillConfig serialize → parse → 원본과 동일 (round-trip)
 ✓ resources가 undefined → 직렬화 시 resources 키 생략
 ```
+
+## env-builder (유닛, ~7개)
+
+```
+[buildEnvFromProfile — 순수 변환]
+✓ gh_user 없음 (undefined) → 빈 객체 반환
+✓ 정상 프로필 (token, name, email) → GH_TOKEN, GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL, GIT_COMMITTER_NAME, GIT_COMMITTER_EMAIL 모두 세팅
+✓ name/email이 빈 문자열 → 빈 문자열 키도 포함 (필터링하지 않음)
+
+[캐시 로직 — resolver 주입]
+✓ 캐시 미스 (첫 호출) → resolver 함수 1회 실행
+✓ 캐시 히트 (동일 ghUser, TTL 내) → resolver 함수 미실행, 캐시된 값 반환
+✓ 캐시 만료 (TTL 초과) → resolver 함수 재실행
+✓ ghUser 변경 → 이전 캐시 무효화, 새 resolver 실행
+```
```
