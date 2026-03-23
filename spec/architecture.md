# cc-company Architecture

## 기술 스택

- **Runtime**: Node.js
- **Language**: TypeScript
- **CLI Parser**: commander
- **Claude Code 연동**: child_process.spawn
- **Frontmatter 파싱**: gray-matter
- **배포**: npm

## 레이어 구조

```
Commands (CLI 파싱) → Services (비즈니스 로직) → Store (데이터 접근) / Claude Runner (실행)
```

```
Webhook Receiver (이벤트 수신) → PR Event Service (이벤트 처리) → Ticket Service (티켓 생성)
```

### Commands

CLI arg 파싱만 수행하고 service를 호출한다. 로직 없음.

### Services

- **agent.service.ts** — agent CRUD + 리소스 assign/unassign
- **resource.service.ts** — 공용 subagent/skill/hook CRUD
- **run.service.ts** — 설정 로드 → 플래그 빌드 → spawn → 로그 저장 오케스트레이션

### Store

파일시스템 읽기/쓰기를 인터페이스로 추상화.
향후 대시보드 서버 API 구현체로 교체 가능.

### Server

HTTP API를 제공하는 Ticket Server.

- **server/index.ts** — Express 앱 생성 및 미들웨어 설정
- **server/routes/tickets.ts** — /tickets API 라우트
- **server/routes/agents.ts** — /agents/status API 라우트

### Webhook Receiver

GitHub webhook 이벤트를 수신하는 추상화 레이어.

- **webhook-receiver/index.ts** — IWebhookReceiver 인터페이스
- **webhook-receiver/smee-receiver.ts** — smee-client 기반 로컬 수신 (개발용)
- **webhook-receiver/sse-receiver.ts** — SSE 기반 원격 수신 (향후 원격 서버용, stub)

```typescript
interface IWebhookReceiver {
  start(): Promise<void>
  stop(): Promise<void>
  onEvent(handler: (event: WebhookEvent) => void): void
}
```

### PR Event Service

GitHub PR 이벤트를 ticket으로 변환.

- **services/pr-event.service.ts** — review comment, approve 이벤트 처리
- **services/merge.service.ts** — PR merge 실행, conflict 감지

### GH Client

gh CLI 명령어 래퍼.

- **gh-client/index.ts** — IGhClient 인터페이스 + 구현체

### Ticket Store

Ticket 데이터 저장소 추상화.

- **ticket-store.ts** — ITicketStore 인터페이스
- **fs-ticket-store.ts** — 파일 기반 구현. 낙관적 락 지원.
- **agent-status-store.ts** — agent 실시간 상태 저장

### Orchestrator

데몬 모드 시스템 관리.

- **orchestrator.service.ts** — Ticket Server 시작 + agent worker spawn + shutdown 관리
- **agent-runner.service.ts** — 개별 agent의 polling loop + ticket 처리

```typescript
interface IStore {
  // agent
  getAgent(name: string): AgentConfig
  listAgents(): AgentConfig[]
  createAgent(config: AgentConfig): void
  removeAgent(name: string): void
  updateAgent(name: string, config: Partial<AgentConfig>): void

  // 공용 리소스
  getSubagent(name: string): SubagentConfig
  listSubagents(): SubagentConfig[]
  createSubagent(config: SubagentConfig): void
  removeSubagent(name: string): void
  // skills, hooks 동일 패턴

  // Skill file operations
  addSkillFile(skillName: string, filePath: string, content: string): void
  editSkillFile(skillName: string, filePath: string, content: string): void
  removeSkillFile(skillName: string, filePath: string): void
  getSkillFile(skillName: string, filePath: string): string
  getSkillDir(skillName: string): string

  // 실행 로그
  saveRunLog(log: RunLog): void
  getRunLogs(filter?: RunLogFilter): RunLog[]
}
```

- **fs-store.ts** — 파일시스템 구현체 (MVP). subagent/skill은 `.md` 파일을 `gray-matter`로 파싱하여 frontmatter → 메타데이터, body → prompt로 분리.
- **api-store.ts** — HTTP API 구현체 (향후 대시보드 연동 시)

### Claude Runner

Claude CLI와의 인터페이스 전담.

- **flag-builder.ts** — AgentConfig → claude CLI 플래그 배열 변환
- **env-builder.ts** — AgentConfig.gh_user → 환경변수 객체 변환 (GH_TOKEN, GIT_AUTHOR_*, GIT_COMMITTER_*). gh CLI로 토큰/identity resolve. 15분 in-memory 캐시.
- **spawner.ts** — child_process.spawn + env 주입 + stdin/stdout/stderr 파이프 + 종료코드 전달

### Logger

- **run-logger.ts** — 실행 메타데이터 + stdout/stderr를 `.cc-company/runs/`에 JSON으로 저장

## 소스 디렉토리 구조

```
src/
├── index.ts                  # CLI 엔트리, commander 설정
├── commands/
│   ├── init.ts
│   ├── run.ts
│   ├── agent.ts
│   ├── subagent.ts
│   ├── skill.ts
│   └── hook.ts
├── services/
│   ├── agent.service.ts
│   ├── resource.service.ts
│   ├── run.service.ts
│   ├── pr-event.service.ts   # PR 이벤트 → ticket 변환
│   └── merge.service.ts      # PR merge 실행
├── server/
│   ├── index.ts
│   ├── routes/
│   │   ├── tickets.ts
│   │   └── agents.ts
│   └── middleware/
│       └── error-handler.ts
├── webhook-receiver/
│   ├── index.ts              # IWebhookReceiver 인터페이스
│   ├── smee-receiver.ts      # smee-client 래퍼 (로컬용)
│   └── sse-receiver.ts       # SSE 클라이언트 (원격용, stub)
├── gh-client/
│   └── index.ts              # IGhClient 인터페이스 + 구현
├── store/
│   ├── store.ts              # 기존 IStore
│   ├── fs-store.ts           # 기존
│   ├── ticket-store.ts       # ITicketStore 인터페이스
│   ├── fs-ticket-store.ts    # 파일 기반 구현
│   └── agent-status-store.ts # agent 상태 저장
├── claude-runner/
│   ├── flag-builder.ts
│   ├── env-builder.ts
│   └── spawner.ts
├── logger/
│   └── run-logger.ts
├── utils/
│   └── frontmatter.ts        # subagent/skill MD 파일의 파싱(parse*Md)과 직렬화(serialize*Md)
├── types/
│   ├── index.ts
│   └── github-events.ts      # GitHub webhook payload 타입
├── agent-worker.ts           # fork용 엔트리포인트
└── templates/                # init 시 복사할 기본 agent 템플릿
```

## 데이터 흐름

### Interactive Mode 예시: `cc-company run developer`

```
1. commands/run.ts
   포지셔널 추출: agent="developer", prompt=undefined (optional)
   mode 결정: -p flag 없음 → interactive mode
   패스스루 수집: []
        │
        ▼
2. services/run.service.ts
   store.getAgent("developer") → AgentConfig
   store.getSubagents(config.subagents) → SubagentConfig[]
   mode="interactive" 전달
        │
        ▼
3. claude-runner/env-builder.ts
   agent.gh_user → gh auth token → gh api /user → env 객체
   gh_user 미설정 시 빈 env (시스템 기본값 사용)
        │
        ▼
4. claude-runner/flag-builder.ts
   AgentConfig + SubagentConfig[] → claude CLI 플래그 배열
   prompt가 undefined이면 마지막 positional arg 생략
   ["--append-system-prompt-file", "...prompt.md",
    "--agents", '{"git-expert":{...}}']
        │
        ▼
5. claude-runner/spawner.ts
   child_process.spawn("claude", flags, { env: { ...process.env, ...ghEnv } })
   stdio: 'inherit' → interactive TUI가 터미널에 표시됨
        │
        ▼
6. logger/run-logger.ts
   RunLog JSON → .cc-company/runs/{timestamp}-{uuid}.json
   prompt: null, mode: "interactive"
```

### Interactive Mode with Prompt 예시: `cc-company run developer "버그 고쳐줘" --model opus`

```
1. commands/run.ts
   포지셔널 추출: agent="developer", prompt="버그 고쳐줘" (optional)
   mode 결정: -p flag 없음 → interactive mode (prompt 있는 interactive)
   패스스루 수집: ["--model", "opus"]
   (-p flag 사용 시 mode="print", prompt 필수)
        │
        ▼
2. services/run.service.ts
   store.getAgent("developer") → AgentConfig
   store.getSubagents(config.subagents) → SubagentConfig[]
   store.getSkills(config.skills) → SkillConfig[]
        │
        ▼
3. claude-runner/env-builder.ts
   agent.gh_user → gh auth token → gh api /user → env 객체
   gh_user 미설정 시 빈 env (시스템 기본값 사용)
        │
        ▼
4. claude-runner/flag-builder.ts
   AgentConfig + SubagentConfig[] → claude CLI 플래그 배열
   prompt가 있으면 마지막 positional arg로 포함
   ["--append-system-prompt-file", "...prompt.md",
    "--agents", '{"git-expert":{...}}',
    "--model", "opus",
    "버그 고쳐줘"]
        │
        ▼
5. claude-runner/spawner.ts
   child_process.spawn("claude", flags, { env: { ...process.env, ...ghEnv } })
   stdout/stderr → 사용자에게 파이프 + 버퍼에 수집
        │
        ▼
6. logger/run-logger.ts
   RunLog JSON → .cc-company/runs/{timestamp}-{uuid}.json
   prompt: "버그 고쳐줘", mode: "interactive"
```

### Skill 전달 흐름 (--add-dir)

run.service에서 skills resolve 후:

```
1. stale temp 정리
   .cc-company/.tmp/run-* 중 1시간 이상 경과한 디렉토리 자동 삭제

2. 임시 디렉토리 생성
   .cc-company/.tmp/run-{uuid}/.claude/skills/ 생성

3. skill 디렉토리 복사
   할당된 skill 디렉토리 전체를 임시 경로로 복사

4. flag-builder
   addDirPath: ".cc-company/.tmp/run-{uuid}" → --add-dir 플래그 생성

5. spawner
   child_process.spawn("claude", [...flags, "--add-dir", addDirPath])

6. 정리 (try/finally)
   spawn 완료 후 임시 디렉토리 삭제
```

### FlagBuilderInput

```typescript
interface FlagBuilderInput {
  promptFilePath: string
  subagents?: SubagentConfig[]
  mcpConfigPath?: string
  settingsPath?: string
  addDirPath?: string           // skills 임시 디렉토리 경로
  passthroughFlags?: string[]
  prompt?: string
}
```

### 데몬 모드 예시: `cc-company start`

```
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
```

### Ticket 생성 → 처리 흐름 (cc 포함)

```
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
```

### Webhook 이벤트 처리 흐름

#### Review Comment → Ticket

```
1. GitHub에서 PR review comment 작성
        │
        ▼
2. Webhook 발송 → smee.io (로컬) 또는 cc-company 서버 (원격)
        │
        ▼
3. SmeeReceiver / SseReceiver가 이벤트 수신
        │
        ▼
4. POST /webhooks/github → webhook-signature 검증
        │
        ▼
5. PrEventService.handleReviewComment()
   - PR author의 gh_user로 agent 매칭
   - 기존 ticket 검색 (같은 PR, ready/blocked 상태)
   - 있으면 업데이트, 없으면 새 ticket 생성
        │
        ▼
6. Agent worker가 ticket 처리
```

#### Approve → Merge

```
1. GitHub에서 PR approve
        │
        ▼
2. Webhook → PrEventService.handleReviewApproved()
   - approveCondition 체크 ('any' 또는 'all')
   - 조건 충족 시 merge ticket 생성
        │
        ▼
3. Agent worker가 merge ticket 처리
   - MergeService.executeMerge() 호출
   - gh pr merge --auto 실행
        │
        ├── 성공 → ticket completed
        │
        └── conflict → git rebase --abort
                     → conflict_resolve ticket 생성
```
