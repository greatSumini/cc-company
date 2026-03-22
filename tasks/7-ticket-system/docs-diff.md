# docs-diff: ticket-system

Baseline: `d1b015d`

## `docs/adr.md`

```diff
diff --git a/docs/adr.md b/docs/adr.md
index 63b5a53..e03c989 100644
--- a/docs/adr.md
+++ b/docs/adr.md
@@ -248,3 +248,63 @@
 - `src/claude-runner/spawner.ts` — env 파라미터 추가
 - `src/services/run.service.ts` — env-builder 호출 → spawner 전달
 - `scripts/run-phases.py` — task index.json의 gh_user 필드 기반 동일 로직
+
+---
+
+## ADR-017: Ticket 기반 작업 관리 시스템
+
+**상태**: 확정 (2026-03-22)
+
+**맥락**: 현재 `cc-company run <agent>`는 1회성 실행이다. agent들이 지속적으로 실행되면서 할당된 작업(ticket)을 처리하는 방식으로 전환이 필요하다. ticket에는 참조(cc) 기능이 있어, 참조된 agent들이 수신확인 후 assignee가 작업을 시작할 수 있다.
+
+**결정**: Ticket 기반 작업 관리 시스템 도입
+
+**설계**:
+- Ticket 타입: `task` (실제 작업), `cc_review` (참조 확인 요청)
+- cc가 있는 ticket 생성 시, cc된 agent 수만큼 `cc_review` ticket도 함께 생성
+- 모든 `cc_review` 완료 시 원본 `task`의 상태가 `blocked` → `ready`로 전환
+- Ticket 상태: `blocked`, `ready`, `in_progress`, `completed`, `failed`, `cancelled`
+- 각 agent는 자신에게 할당된 `ready` ticket을 priority → createdAt 순으로 처리
+- 낙관적 락(version 필드)으로 동시성 제어
+
+---
+
+## ADR-018: Ticket Server — 파일 저장 + HTTP API
+
+**상태**: 확정 (2026-03-22)
+
+**맥락**: agent 프로세스들이 ticket 저장소에 접근하는 방식을 결정해야 한다. 향후 GUI 대시보드 연동과 원격 서버 전환을 고려해야 한다.
+
+**결정**: 파일 저장 + HTTP API
+
+**근거**:
+- 파일 저장: `.cc-company/tickets/{id}.json`에 저장. git 추적 가능, 단순
+- HTTP API: 각 agent가 REST API로 ticket CRUD. GUI 대시보드 연동 자연스러움
+- ITicketStore 인터페이스로 추상화 → 향후 원격 서버 전환 시 API 스펙 유지
+
+**구현 위치**:
+- `src/server/` — Express 기반 HTTP 서버
+- `src/store/ticket-store.ts` — ITicketStore 인터페이스
+- `src/store/fs-ticket-store.ts` — 파일 기반 구현
+
+---
+
+## ADR-019: Agent 프로세스 관리 — fork + idle timeout
+
+**상태**: 확정 (2026-03-22)
+
+**맥락**: `cc-company start` 실행 시 여러 agent 프로세스를 관리하는 방식을 결정해야 한다.
+
+**결정**: child_process.fork() + idle timeout (3분)
+
+**근거**:
+- `cc-company start` 시 Ticket Server 시작 + 모든 agent worker 프로세스 fork
+- 각 agent는 polling loop로 ticket 조회 (5초 간격)
+- 3분간 작업 없으면 해당 agent 자동 종료
+- 모든 agent 종료 후에도 Ticket Server는 유지 (사용자가 Ctrl+C로 종료)
+- graceful shutdown: SIGINT/SIGTERM 핸들링
+
+**구현 위치**:
+- `src/services/orchestrator.service.ts` — 전체 시스템 부트스트랩
+- `src/services/agent-runner.service.ts` — 개별 agent polling loop
+- `src/agent-worker.ts` — fork용 엔트리포인트
```

## `docs/architecture.md`

```diff
diff --git a/docs/architecture.md b/docs/architecture.md
index 6295dff..25ec105 100644
--- a/docs/architecture.md
+++ b/docs/architecture.md
@@ -30,6 +30,29 @@ CLI arg 파싱만 수행하고 service를 호출한다. 로직 없음.
 파일시스템 읽기/쓰기를 인터페이스로 추상화.
 향후 대시보드 서버 API 구현체로 교체 가능.
 
+### Server
+
+HTTP API를 제공하는 Ticket Server.
+
+- **server/index.ts** — Express 앱 생성 및 미들웨어 설정
+- **server/routes/tickets.ts** — /tickets API 라우트
+- **server/routes/agents.ts** — /agents/status API 라우트
+
+### Ticket Store
+
+Ticket 데이터 저장소 추상화.
+
+- **ticket-store.ts** — ITicketStore 인터페이스
+- **fs-ticket-store.ts** — 파일 기반 구현. 낙관적 락 지원.
+- **agent-status-store.ts** — agent 실시간 상태 저장
+
+### Orchestrator
+
+데몬 모드 시스템 관리.
+
+- **orchestrator.service.ts** — Ticket Server 시작 + agent worker spawn + shutdown 관리
+- **agent-runner.service.ts** — 개별 agent의 polling loop + ticket 처리
+
 ```typescript
 interface IStore {
   // agent
@@ -90,9 +113,19 @@ src/
 │   ├── agent.service.ts
 │   ├── resource.service.ts
 │   └── run.service.ts
+├── server/
+│   ├── index.ts
+│   ├── routes/
+│   │   ├── tickets.ts
+│   │   └── agents.ts
+│   └── middleware/
+│       └── error-handler.ts
 ├── store/
-│   ├── store.ts              # IStore 인터페이스
-│   └── fs-store.ts
+│   ├── store.ts              # 기존 IStore
+│   ├── fs-store.ts           # 기존
+│   ├── ticket-store.ts       # ITicketStore 인터페이스
+│   ├── fs-ticket-store.ts    # 파일 기반 구현
+│   └── agent-status-store.ts # agent 상태 저장
 ├── claude-runner/
 │   ├── flag-builder.ts
 │   ├── env-builder.ts
@@ -103,6 +136,7 @@ src/
 │   └── frontmatter.ts        # subagent/skill MD 파일의 파싱(parse*Md)과 직렬화(serialize*Md)
 ├── types/
 │   └── index.ts
+├── agent-worker.ts           # fork용 엔트리포인트
 └── templates/                # init 시 복사할 기본 agent 템플릿
 ```
 
@@ -222,3 +256,61 @@ interface FlagBuilderInput {
   prompt?: string
 }
 ```
+
+### 데몬 모드 예시: `cc-company start`
+
+```
+1. commands/start.ts
+   orchestrator.start() 호출
+        │
+        ▼
+2. services/orchestrator.service.ts
+   Ticket Server 시작 (http://localhost:3847)
+   모든 agent에 대해 child_process.fork('agent-worker.ts')
+        │
+        ├──▶ Agent Worker (developer)
+        ├──▶ Agent Worker (designer)
+        └──▶ Agent Worker (hr)
+             │
+             ▼
+3. agent-worker.ts → services/agent-runner.service.ts
+   while (alive) {
+     sendHeartbeat()
+     ticket = HTTP GET /tickets?assignee={name}&status=ready
+     if (ticket) processTicket(ticket)
+     if (idleTime > 3분) break
+     sleep(5초)
+   }
+        │
+        ▼
+4. ticket 처리 시
+   HTTP PATCH /tickets/{id} { status: 'in_progress' }
+   spawnSync('claude', ...) // 기존 claude-runner 활용
+   HTTP PATCH /tickets/{id} { status: 'completed', result: {...} }
+```
+
+### Ticket 생성 → 처리 흐름 (cc 포함)
+
+```
+1. cc-company ticket create --assignee developer --cc designer
+        │
+        ▼
+2. HTTP POST /tickets
+   TicketService.createTicket():
+     - task ticket 생성 (status: blocked)
+     - cc_review ticket 생성 (assignee: designer, status: ready)
+        │
+        ▼
+3. Designer Worker
+   cc_review ticket 발견 → 처리 → completed
+   의견이 있으면 comment 추가
+        │
+        ▼
+4. TicketService.checkCcCompletion()
+   모든 cc_review completed → task status: blocked → ready
+   cc_review comments를 task에 복사
+        │
+        ▼
+5. Developer Worker
+   task ticket 발견 → 처리 → completed
+```
```

## `docs/spec.md`

```diff
diff --git a/docs/spec.md b/docs/spec.md
index 0b5abd0..eea5476 100644
--- a/docs/spec.md
+++ b/docs/spec.md
@@ -38,6 +38,32 @@ cc-company agent remove <name>    # agent 삭제
 cc-company agent <name> show      # agent 상세 조회 (할당된 리소스 포함)
 ```
 
+### 데몬 모드 실행
+
+```bash
+cc-company start          # Ticket Server + 모든 agent worker 시작
+```
+
+- Ticket Server를 시작하고 모든 등록된 agent의 worker 프로세스를 spawn
+- 각 agent worker는 자신에게 할당된 ticket을 polling하며 대기
+- 3분간 작업 없으면 해당 agent worker 자동 종료
+- 모든 agent 종료 후에도 서버는 유지 (Ctrl+C로 종료)
+- 기존 `cc-company run <agent>` 명령어는 1회성 실행으로 유지
+
+### Ticket 관리
+
+```bash
+cc-company ticket create --assignee <agent> [--cc <agents>] --title <title> --prompt <prompt> [--priority <p>]
+cc-company ticket list [--status <s>] [--assignee <a>]
+cc-company ticket show <id>
+cc-company ticket cancel <id>
+```
+
+- `--cc`: 쉼표로 구분된 agent 목록 (예: `--cc designer,hr`)
+- `--priority`: `low`, `normal`, `high`, `urgent` (기본값: `normal`)
+- cc가 있으면 원본 ticket은 `blocked` 상태로 생성되고, cc된 agent 수만큼 `cc_review` ticket이 함께 생성됨
+- `cc_review` ticket 완료 시 의견이 원본 ticket의 comments에 복사됨
+
 ### Agent 리소스 할당
 
 ```bash
@@ -100,6 +126,7 @@ cc-company hook add|list|remove <name>
   "name": "developer",
   "description": "소프트웨어 개발 전담 에이전트",
   "gh_user": "dev-bot",
+  "can_delegate": true,
   "subagents": ["git-expert", "code-reviewer"],
   "skills": ["deploy"],
   "hooks": ["pre-commit"]
@@ -109,6 +136,55 @@ cc-company hook add|list|remove <name>
 - 모든 리소스 필드는 optional
 - 값은 공용 풀의 리소스 이름(식별자) 배열
 - `gh_user`: optional. gh CLI에 등록된 GitHub 계정명. 설정 시 해당 계정의 토큰과 Git identity로 commit/push/PR 수행. 미설정 시 현재 활성 계정 사용.
+- `can_delegate`: optional. true이면 다른 agent에게 ticket 위임(생성) 가능. 기본값 false.
+
+## Ticket JSON 스키마
+
+```json
+{
+  "id": "uuid",
+  "title": "버그 수정",
+  "prompt": "로그인 버튼이 동작하지 않는 버그를 수정해주세요.",
+  "type": "task",
+  "parentTicketId": null,
+  "ccReviewTicketIds": ["cc-001", "cc-002"],
+  "assignee": "developer",
+  "priority": "normal",
+  "status": "ready",
+  "createdBy": "user",
+  "createdAt": "2026-03-22T10:00:00+0900",
+  "startedAt": null,
+  "completedAt": null,
+  "cancelledAt": null,
+  "result": null,
+  "comments": [],
+  "version": 1
+}
+```
+
+- `type`: `task` (실제 작업) 또는 `cc_review` (참조 확인 요청)
+- `parentTicketId`: `cc_review`인 경우 원본 ticket ID
+- `ccReviewTicketIds`: `task`인 경우 연결된 `cc_review` ticket ID 목록
+- `status`: `blocked`, `ready`, `in_progress`, `completed`, `failed`, `cancelled`
+- `priority`: `low`, `normal`, `high`, `urgent`. `cc_review`는 parent의 priority를 따름
+- `createdBy`: `user` 또는 agent name (위임 시)
+- `result`: 완료 시 `{ exitCode: number, logPath: string }`
+- `comments`: `[{ id, author, content, createdAt }]`
+- `version`: 낙관적 락용 버전 번호
+
+## config.json 확장
+
+```json
+{
+  "version": "1.0.0",
+  "ticketServer": {
+    "port": 3847,
+    "pollingIntervalMs": 5000,
+    "idleTimeoutMs": 180000,
+    "heartbeatTimeoutMs": 30000
+  }
+}
+```
 
 ## Subagent MD 형식
 
```

## `docs/test-cases.md`

```diff
diff --git a/docs/test-cases.md b/docs/test-cases.md
index 30f0e74..b40458d 100644
--- a/docs/test-cases.md
+++ b/docs/test-cases.md
@@ -159,3 +159,55 @@ store는 in-memory fake 또는 실제 fs-store + 임시 디렉토리.
 ✓ 캐시 만료 (TTL 초과) → resolver 함수 재실행
 ✓ ghUser 변경 → 이전 캐시 무효화, 새 resolver 실행
 ```
+
+## fs-ticket-store (통합, ~15개)
+
+[CRUD 기본]
+✓ create() 기본 — ticket 생성 후 파일 존재, 필수 필드 확인
+✓ create() ID 자동 생성 — uuid 형식 검증
+✓ get() 존재하는 ticket — 정상 반환
+✓ get() 존재하지 않는 ticket — null 반환
+✓ list() 필터 없음 — 전체 목록 반환
+✓ list() status 필터 — 해당 status만 반환
+✓ list() assignee 필터 — 해당 assignee만 반환
+✓ list() 복합 필터 — status + assignee 동시 적용
+
+[update 및 낙관적 락]
+✓ update() 정상 — 필드 업데이트, version 증가
+✓ update() 낙관적 락 실패 — version 불일치 시 에러
+
+[cancel]
+✓ cancel() blocked 상태 — 정상 취소, cancelledAt 기록
+✓ cancel() ready 상태 — 정상 취소
+✓ cancel() in_progress 상태 — 에러 (취소 불가)
+
+[comments 및 log]
+✓ addComment() — comments 배열에 추가
+✓ saveLog() / getLog() — 로그 파일 저장/조회
+
+## agent-status-store (통합, ~6개)
+
+✓ updateHeartbeat() — lastHeartbeatAt 갱신
+✓ updateState() — state 변경 (idle → working)
+✓ getAll() — 전체 agent 상태 반환
+✓ get() 존재하는 agent — 정상 반환
+✓ get() 존재하지 않는 agent — null 반환
+✓ offline 판정 — heartbeatTimeout 초과 시 state=offline
+
+## ticket.service (유닛, ~10개)
+
+[createTicket]
+✓ cc 없음 — task ticket 생성, status=ready
+✓ cc 있음 — task(blocked) + cc_review(ready) 생성
+✓ cc_review priority — parent priority와 동일
+✓ 위임 (agent → agent) — can_delegate=true 확인
+✓ 위임 권한 없음 — can_delegate=false 시 에러
+
+[priority 및 cancel]
+✓ updatePriority() task — 연결된 cc_review도 함께 변경
+✓ cancelTicket() task with cc_review — 연결된 cc_review도 함께 취소
+
+[cc completion]
+✓ checkCcCompletion() 일부 완료 — parent 상태 유지 (blocked)
+✓ checkCcCompletion() 전체 완료 — parent status → ready, comments 복사
+✓ addComment() cc_review — parent ticket에도 comment 복사
```
