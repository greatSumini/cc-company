# Phase 0: docs

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/spec.md`
- `/docs/architecture.md`
- `/docs/adr.md`
- `/docs/test-cases.md`
- `/docs/testing.md`

## 작업 내용

Ticket 시스템 도입을 위한 문서 업데이트를 수행한다.

### 1. `docs/adr.md` — ADR 추가

파일 끝에 아래 3개의 ADR을 추가:

```markdown
## ADR-017: Ticket 기반 작업 관리 시스템

**상태**: 확정 (2026-03-22)

**맥락**: 현재 `cc-company run <agent>`는 1회성 실행이다. agent들이 지속적으로 실행되면서 할당된 작업(ticket)을 처리하는 방식으로 전환이 필요하다. ticket에는 참조(cc) 기능이 있어, 참조된 agent들이 수신확인 후 assignee가 작업을 시작할 수 있다.

**결정**: Ticket 기반 작업 관리 시스템 도입

**설계**:
- Ticket 타입: `task` (실제 작업), `cc_review` (참조 확인 요청)
- cc가 있는 ticket 생성 시, cc된 agent 수만큼 `cc_review` ticket도 함께 생성
- 모든 `cc_review` 완료 시 원본 `task`의 상태가 `blocked` → `ready`로 전환
- Ticket 상태: `blocked`, `ready`, `in_progress`, `completed`, `failed`, `cancelled`
- 각 agent는 자신에게 할당된 `ready` ticket을 priority → createdAt 순으로 처리
- 낙관적 락(version 필드)으로 동시성 제어

---

## ADR-018: Ticket Server — 파일 저장 + HTTP API

**상태**: 확정 (2026-03-22)

**맥락**: agent 프로세스들이 ticket 저장소에 접근하는 방식을 결정해야 한다. 향후 GUI 대시보드 연동과 원격 서버 전환을 고려해야 한다.

**결정**: 파일 저장 + HTTP API

**근거**:
- 파일 저장: `.cc-company/tickets/{id}.json`에 저장. git 추적 가능, 단순
- HTTP API: 각 agent가 REST API로 ticket CRUD. GUI 대시보드 연동 자연스러움
- ITicketStore 인터페이스로 추상화 → 향후 원격 서버 전환 시 API 스펙 유지

**구현 위치**:
- `src/server/` — Express 기반 HTTP 서버
- `src/store/ticket-store.ts` — ITicketStore 인터페이스
- `src/store/fs-ticket-store.ts` — 파일 기반 구현

---

## ADR-019: Agent 프로세스 관리 — fork + idle timeout

**상태**: 확정 (2026-03-22)

**맥락**: `cc-company start` 실행 시 여러 agent 프로세스를 관리하는 방식을 결정해야 한다.

**결정**: child_process.fork() + idle timeout (3분)

**근거**:
- `cc-company start` 시 Ticket Server 시작 + 모든 agent worker 프로세스 fork
- 각 agent는 polling loop로 ticket 조회 (5초 간격)
- 3분간 작업 없으면 해당 agent 자동 종료
- 모든 agent 종료 후에도 Ticket Server는 유지 (사용자가 Ctrl+C로 종료)
- graceful shutdown: SIGINT/SIGTERM 핸들링

**구현 위치**:
- `src/services/orchestrator.service.ts` — 전체 시스템 부트스트랩
- `src/services/agent-runner.service.ts` — 개별 agent polling loop
- `src/agent-worker.ts` — fork용 엔트리포인트
```

### 2. `docs/spec.md` — 새 명령어 및 스키마 추가

#### 2-1. CLI Commands 섹션에 추가

`### Agent 관리` 섹션 뒤에 다음을 추가:

```markdown
### 데몬 모드 실행

\`\`\`bash
cc-company start          # Ticket Server + 모든 agent worker 시작
\`\`\`

- Ticket Server를 시작하고 모든 등록된 agent의 worker 프로세스를 spawn
- 각 agent worker는 자신에게 할당된 ticket을 polling하며 대기
- 3분간 작업 없으면 해당 agent worker 자동 종료
- 모든 agent 종료 후에도 서버는 유지 (Ctrl+C로 종료)
- 기존 `cc-company run <agent>` 명령어는 1회성 실행으로 유지

### Ticket 관리

\`\`\`bash
cc-company ticket create --assignee <agent> [--cc <agents>] --title <title> --prompt <prompt> [--priority <p>]
cc-company ticket list [--status <s>] [--assignee <a>]
cc-company ticket show <id>
cc-company ticket cancel <id>
\`\`\`

- `--cc`: 쉼표로 구분된 agent 목록 (예: `--cc designer,hr`)
- `--priority`: `low`, `normal`, `high`, `urgent` (기본값: `normal`)
- cc가 있으면 원본 ticket은 `blocked` 상태로 생성되고, cc된 agent 수만큼 `cc_review` ticket이 함께 생성됨
- `cc_review` ticket 완료 시 의견이 원본 ticket의 comments에 복사됨
```

#### 2-2. agent.json 스키마 섹션에 필드 추가

기존 JSON 예시를 다음으로 교체:

```json
{
  "name": "developer",
  "description": "소프트웨어 개발 전담 에이전트",
  "gh_user": "dev-bot",
  "can_delegate": true,
  "subagents": ["git-expert", "code-reviewer"],
  "skills": ["deploy"],
  "hooks": ["pre-commit"]
}
```

설명에 추가:
```
- `can_delegate`: optional. true이면 다른 agent에게 ticket 위임(생성) 가능. 기본값 false.
```

#### 2-3. Ticket JSON 스키마 섹션 추가

`## agent.json 스키마` 섹션 뒤에 다음을 추가:

```markdown
## Ticket JSON 스키마

\`\`\`json
{
  "id": "uuid",
  "title": "버그 수정",
  "prompt": "로그인 버튼이 동작하지 않는 버그를 수정해주세요.",
  "type": "task",
  "parentTicketId": null,
  "ccReviewTicketIds": ["cc-001", "cc-002"],
  "assignee": "developer",
  "priority": "normal",
  "status": "ready",
  "createdBy": "user",
  "createdAt": "2026-03-22T10:00:00+0900",
  "startedAt": null,
  "completedAt": null,
  "cancelledAt": null,
  "result": null,
  "comments": [],
  "version": 1
}
\`\`\`

- `type`: `task` (실제 작업) 또는 `cc_review` (참조 확인 요청)
- `parentTicketId`: `cc_review`인 경우 원본 ticket ID
- `ccReviewTicketIds`: `task`인 경우 연결된 `cc_review` ticket ID 목록
- `status`: `blocked`, `ready`, `in_progress`, `completed`, `failed`, `cancelled`
- `priority`: `low`, `normal`, `high`, `urgent`. `cc_review`는 parent의 priority를 따름
- `createdBy`: `user` 또는 agent name (위임 시)
- `result`: 완료 시 `{ exitCode: number, logPath: string }`
- `comments`: `[{ id, author, content, createdAt }]`
- `version`: 낙관적 락용 버전 번호

## config.json 확장

\`\`\`json
{
  "version": "1.0.0",
  "ticketServer": {
    "port": 3847,
    "pollingIntervalMs": 5000,
    "idleTimeoutMs": 180000,
    "heartbeatTimeoutMs": 30000
  }
}
\`\`\`
```

### 3. `docs/architecture.md` — 새 레이어 및 데이터 흐름 추가

#### 3-1. 레이어 구조 섹션 업데이트

기존 레이어 설명 뒤에 추가:

```markdown
### Server

HTTP API를 제공하는 Ticket Server.

- **server/index.ts** — Express 앱 생성 및 미들웨어 설정
- **server/routes/tickets.ts** — /tickets API 라우트
- **server/routes/agents.ts** — /agents/status API 라우트

### Ticket Store

Ticket 데이터 저장소 추상화.

- **ticket-store.ts** — ITicketStore 인터페이스
- **fs-ticket-store.ts** — 파일 기반 구현. 낙관적 락 지원.
- **agent-status-store.ts** — agent 실시간 상태 저장

### Orchestrator

데몬 모드 시스템 관리.

- **orchestrator.service.ts** — Ticket Server 시작 + agent worker spawn + shutdown 관리
- **agent-runner.service.ts** — 개별 agent의 polling loop + ticket 처리
```

#### 3-2. 소스 디렉토리 구조 업데이트

기존 구조에 다음을 추가:

```
├── server/
│   ├── index.ts
│   ├── routes/
│   │   ├── tickets.ts
│   │   └── agents.ts
│   └── middleware/
│       └── error-handler.ts
├── store/
│   ├── store.ts              # 기존 IStore
│   ├── fs-store.ts           # 기존
│   ├── ticket-store.ts       # ITicketStore 인터페이스
│   ├── fs-ticket-store.ts    # 파일 기반 구현
│   └── agent-status-store.ts # agent 상태 저장
├── agent-worker.ts           # fork용 엔트리포인트
```

#### 3-3. 데몬 모드 데이터 흐름 추가

문서 끝에 다음을 추가:

```markdown
### 데몬 모드 예시: `cc-company start`

\`\`\`
1. commands/start.ts
   orchestrator.start() 호출
        │
        ▼
2. services/orchestrator.service.ts
   Ticket Server 시작 (http://localhost:3847)
   모든 agent에 대해 child_process.fork('agent-worker.ts')
        │
        ├──▶ Agent Worker (developer)
        ├──▶ Agent Worker (designer)
        └──▶ Agent Worker (hr)
             │
             ▼
3. agent-worker.ts → services/agent-runner.service.ts
   while (alive) {
     sendHeartbeat()
     ticket = HTTP GET /tickets?assignee={name}&status=ready
     if (ticket) processTicket(ticket)
     if (idleTime > 3분) break
     sleep(5초)
   }
        │
        ▼
4. ticket 처리 시
   HTTP PATCH /tickets/{id} { status: 'in_progress' }
   spawnSync('claude', ...) // 기존 claude-runner 활용
   HTTP PATCH /tickets/{id} { status: 'completed', result: {...} }
\`\`\`

### Ticket 생성 → 처리 흐름 (cc 포함)

\`\`\`
1. cc-company ticket create --assignee developer --cc designer
        │
        ▼
2. HTTP POST /tickets
   TicketService.createTicket():
     - task ticket 생성 (status: blocked)
     - cc_review ticket 생성 (assignee: designer, status: ready)
        │
        ▼
3. Designer Worker
   cc_review ticket 발견 → 처리 → completed
   의견이 있으면 comment 추가
        │
        ▼
4. TicketService.checkCcCompletion()
   모든 cc_review completed → task status: blocked → ready
   cc_review comments를 task에 복사
        │
        ▼
5. Developer Worker
   task ticket 발견 → 처리 → completed
\`\`\`
```

### 4. `docs/test-cases.md` — 테스트 케이스 추가

파일 끝에 다음 섹션을 추가:

```markdown
## fs-ticket-store (통합, ~15개)

[CRUD 기본]
✓ create() 기본 — ticket 생성 후 파일 존재, 필수 필드 확인
✓ create() ID 자동 생성 — uuid 형식 검증
✓ get() 존재하는 ticket — 정상 반환
✓ get() 존재하지 않는 ticket — null 반환
✓ list() 필터 없음 — 전체 목록 반환
✓ list() status 필터 — 해당 status만 반환
✓ list() assignee 필터 — 해당 assignee만 반환
✓ list() 복합 필터 — status + assignee 동시 적용

[update 및 낙관적 락]
✓ update() 정상 — 필드 업데이트, version 증가
✓ update() 낙관적 락 실패 — version 불일치 시 에러

[cancel]
✓ cancel() blocked 상태 — 정상 취소, cancelledAt 기록
✓ cancel() ready 상태 — 정상 취소
✓ cancel() in_progress 상태 — 에러 (취소 불가)

[comments 및 log]
✓ addComment() — comments 배열에 추가
✓ saveLog() / getLog() — 로그 파일 저장/조회

## agent-status-store (통합, ~6개)

✓ updateHeartbeat() — lastHeartbeatAt 갱신
✓ updateState() — state 변경 (idle → working)
✓ getAll() — 전체 agent 상태 반환
✓ get() 존재하는 agent — 정상 반환
✓ get() 존재하지 않는 agent — null 반환
✓ offline 판정 — heartbeatTimeout 초과 시 state=offline

## ticket.service (유닛, ~10개)

[createTicket]
✓ cc 없음 — task ticket 생성, status=ready
✓ cc 있음 — task(blocked) + cc_review(ready) 생성
✓ cc_review priority — parent priority와 동일
✓ 위임 (agent → agent) — can_delegate=true 확인
✓ 위임 권한 없음 — can_delegate=false 시 에러

[priority 및 cancel]
✓ updatePriority() task — 연결된 cc_review도 함께 변경
✓ cancelTicket() task with cc_review — 연결된 cc_review도 함께 취소

[cc completion]
✓ checkCcCompletion() 일부 완료 — parent 상태 유지 (blocked)
✓ checkCcCompletion() 전체 완료 — parent status → ready, comments 복사
✓ addComment() cc_review — parent ticket에도 comment 복사
```

## Acceptance Criteria

```bash
npm run build  # 컴파일 에러 없음
npm test       # 기존 테스트 모두 통과
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/7-ticket-system/index.json`의 phase 0 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 문서만 수정하라. 코드는 절대 건드리지 마라.
- 기존 문서의 다른 부분을 변경하지 마라. 추가/수정 지시된 부분만 정확히 반영하라.
- ADR 번호가 기존과 충돌하지 않는지 확인하라 (현재 마지막: ADR-016).
