# docs-diff: pr-webhook

Baseline: `3959c95`

## `docs/adr.md`

```diff
diff --git a/docs/adr.md b/docs/adr.md
index e03c989..f472e70 100644
--- a/docs/adr.md
+++ b/docs/adr.md
@@ -308,3 +308,56 @@
 - `src/services/orchestrator.service.ts` — 전체 시스템 부트스트랩
 - `src/services/agent-runner.service.ts` — 개별 agent polling loop
 - `src/agent-worker.ts` — fork용 엔트리포인트
+
+---
+
+## ADR-020: Webhook 기반 PR 이벤트 연동
+
+**상태**: 확정 (2026-03-23)
+
+**맥락**: agent가 작성한 PR에 review comment나 approve가 달리면 자동으로 ticket을 생성하여 agent가 대응할 수 있게 해야 한다. GitHub App vs repo-level webhook, 로컬 개발 환경에서의 webhook 수신 방법을 결정해야 한다.
+
+**결정**: Repo-level webhook + smee.io (로컬) / 자체 SSE (원격)
+
+**근거**:
+- GitHub App은 설치 복잡도가 높고, MVP 단계에서 과잉
+- Repo-level webhook은 설정이 단순하고 필요한 기능 충분
+- 로컬 환경은 퍼블릭 IP가 없으므로 smee.io 프록시 사용
+- 향후 원격 서버 모드에서는 자체 SSE 엔드포인트로 대체 (smee 노출 없이)
+- IWebhookReceiver 인터페이스로 추상화하여 전환 비용 최소화
+
+**구현 위치**:
+- `src/webhook-receiver/` — 수신 추상화
+- `src/server/routes/webhooks.ts` — HTTP 엔드포인트
+- `src/services/pr-event.service.ts` — 이벤트 처리
+
+---
+
+## ADR-021: Ticket metadata 범용 필드
+
+**상태**: 확정 (2026-03-23)
+
+**맥락**: webhook으로 생성된 ticket은 PR 번호, comment ID 등 추가 정보가 필요하다. 중복 ticket 방지, merge 시 PR 정보 참조 등에 사용된다. ticket 스키마에 어떻게 추가할 것인가.
+
+**결정**: `metadata` 필드 (범용 JSON 객체)
+
+**근거**:
+- `prNumber` 같은 단일 필드보다 확장성 있음
+- 향후 Jira, Slack 등 다른 소스 연동 시 해당 키만 추가
+- `metadata.source`로 생성 출처 추적 (user/webhook/agent)
+- `metadata.github`로 GitHub 관련 정보 묶음
+
+**스키마**:
+```typescript
+interface TicketMetadata {
+  source?: 'user' | 'webhook' | 'agent'
+  github?: {
+    repo: string
+    prNumber: number
+    prUrl: string
+    commentIds?: string[]
+    eventType?: 'review_comment' | 'review_approved' | 'conflict_resolve'
+    reviewers?: string[]
+  }
+}
+```
```

## `docs/architecture.md`

```diff
diff --git a/docs/architecture.md b/docs/architecture.md
index 25ec105..9cedd3d 100644
--- a/docs/architecture.md
+++ b/docs/architecture.md
@@ -15,6 +15,10 @@
 Commands (CLI 파싱) → Services (비즈니스 로직) → Store (데이터 접근) / Claude Runner (실행)
 ```
 
+```
+Webhook Receiver (이벤트 수신) → PR Event Service (이벤트 처리) → Ticket Service (티켓 생성)
+```
+
 ### Commands
 
 CLI arg 파싱만 수행하고 service를 호출한다. 로직 없음.
@@ -38,6 +42,35 @@ HTTP API를 제공하는 Ticket Server.
 - **server/routes/tickets.ts** — /tickets API 라우트
 - **server/routes/agents.ts** — /agents/status API 라우트
 
+### Webhook Receiver
+
+GitHub webhook 이벤트를 수신하는 추상화 레이어.
+
+- **webhook-receiver/index.ts** — IWebhookReceiver 인터페이스
+- **webhook-receiver/smee-receiver.ts** — smee-client 기반 로컬 수신 (개발용)
+- **webhook-receiver/sse-receiver.ts** — SSE 기반 원격 수신 (향후 원격 서버용, stub)
+
+```typescript
+interface IWebhookReceiver {
+  start(): Promise<void>
+  stop(): Promise<void>
+  onEvent(handler: (event: WebhookEvent) => void): void
+}
+```
+
+### PR Event Service
+
+GitHub PR 이벤트를 ticket으로 변환.
+
+- **services/pr-event.service.ts** — review comment, approve 이벤트 처리
+- **services/merge.service.ts** — PR merge 실행, conflict 감지
+
+### GH Client
+
+gh CLI 명령어 래퍼.
+
+- **gh-client/index.ts** — IGhClient 인터페이스 + 구현체
+
 ### Ticket Store
 
 Ticket 데이터 저장소 추상화.
@@ -112,7 +145,9 @@ src/
 ├── services/
 │   ├── agent.service.ts
 │   ├── resource.service.ts
-│   └── run.service.ts
+│   ├── run.service.ts
+│   ├── pr-event.service.ts   # PR 이벤트 → ticket 변환
+│   └── merge.service.ts      # PR merge 실행
 ├── server/
 │   ├── index.ts
 │   ├── routes/
@@ -120,6 +155,12 @@ src/
 │   │   └── agents.ts
 │   └── middleware/
 │       └── error-handler.ts
+├── webhook-receiver/
+│   ├── index.ts              # IWebhookReceiver 인터페이스
+│   ├── smee-receiver.ts      # smee-client 래퍼 (로컬용)
+│   └── sse-receiver.ts       # SSE 클라이언트 (원격용, stub)
+├── gh-client/
+│   └── index.ts              # IGhClient 인터페이스 + 구현
 ├── store/
 │   ├── store.ts              # 기존 IStore
 │   ├── fs-store.ts           # 기존
@@ -135,7 +176,8 @@ src/
 ├── utils/
 │   └── frontmatter.ts        # subagent/skill MD 파일의 파싱(parse*Md)과 직렬화(serialize*Md)
 ├── types/
-│   └── index.ts
+│   ├── index.ts
+│   └── github-events.ts      # GitHub webhook payload 타입
 ├── agent-worker.ts           # fork용 엔트리포인트
 └── templates/                # init 시 복사할 기본 agent 템플릿
 ```
@@ -314,3 +356,50 @@ interface FlagBuilderInput {
 5. Developer Worker
    task ticket 발견 → 처리 → completed
 ```
+
+### Webhook 이벤트 처리 흐름
+
+#### Review Comment → Ticket
+
+```
+1. GitHub에서 PR review comment 작성
+        │
+        ▼
+2. Webhook 발송 → smee.io (로컬) 또는 cc-company 서버 (원격)
+        │
+        ▼
+3. SmeeReceiver / SseReceiver가 이벤트 수신
+        │
+        ▼
+4. POST /webhooks/github → webhook-signature 검증
+        │
+        ▼
+5. PrEventService.handleReviewComment()
+   - PR author의 gh_user로 agent 매칭
+   - 기존 ticket 검색 (같은 PR, ready/blocked 상태)
+   - 있으면 업데이트, 없으면 새 ticket 생성
+        │
+        ▼
+6. Agent worker가 ticket 처리
+```
+
+#### Approve → Merge
+
+```
+1. GitHub에서 PR approve
+        │
+        ▼
+2. Webhook → PrEventService.handleReviewApproved()
+   - approveCondition 체크 ('any' 또는 'all')
+   - 조건 충족 시 merge ticket 생성
+        │
+        ▼
+3. Agent worker가 merge ticket 처리
+   - MergeService.executeMerge() 호출
+   - gh pr merge --auto 실행
+        │
+        ├── 성공 → ticket completed
+        │
+        └── conflict → git rebase --abort
+                     → conflict_resolve ticket 생성
+```
```

## `docs/spec.md`

```diff
diff --git a/docs/spec.md b/docs/spec.md
index e4fea98..4560b5d 100644
--- a/docs/spec.md
+++ b/docs/spec.md
@@ -59,6 +59,14 @@ cc-company ticket show <id>
 cc-company ticket cancel <id>
 ```
 
+### Webhook 관리
+
+```bash
+cc-company webhook setup <smee-url>  # smeeUrl을 config에 저장, enabled=true
+cc-company webhook status            # 현재 webhook 설정 표시
+cc-company webhook disable           # webhook.enabled = false
+```
+
 - `--cc`: 쉼표로 구분된 agent 목록 (예: `--cc designer,hr`)
 - `--priority`: `low`, `normal`, `high`, `urgent` (기본값: `normal`)
 - cc가 있으면 원본 ticket은 `blocked` 상태로 생성되고, cc된 agent 수만큼 `cc_review` ticket이 함께 생성됨
@@ -158,6 +166,17 @@ cc-company hook add|list|remove <name>
   "cancelledAt": null,
   "result": null,
   "comments": [],
+  "metadata": {
+    "source": "webhook",
+    "github": {
+      "repo": "owner/repo",
+      "prNumber": 42,
+      "prUrl": "https://github.com/owner/repo/pull/42",
+      "commentIds": ["c1", "c2"],
+      "eventType": "review_comment",
+      "reviewers": ["reviewer1"]
+    }
+  },
   "version": 1
 }
 ```
@@ -170,6 +189,10 @@ cc-company hook add|list|remove <name>
 - `createdBy`: `user` 또는 agent name (위임 시)
 - `result`: 완료 시 `{ exitCode: number, logPath: string }`
 - `comments`: `[{ id, author, content, createdAt }]`
+- `metadata`: 선택적 필드. ticket 생성 출처 및 관련 정보
+- `metadata.source`: `'user'` | `'webhook'` | `'agent'`
+- `metadata.github`: GitHub PR 관련 정보 (webhook으로 생성된 경우)
+- `metadata.github.eventType`: `'review_comment'` | `'review_approved'` | `'conflict_resolve'`
 - `version`: 낙관적 락용 버전 번호
 
 ## config.json 확장
@@ -182,10 +205,22 @@ cc-company hook add|list|remove <name>
     "pollingIntervalMs": 5000,
     "idleTimeoutMs": 180000,
     "heartbeatTimeoutMs": 30000
+  },
+  "webhook": {
+    "enabled": true,
+    "secret": "github-webhook-secret",
+    "smeeUrl": "https://smee.io/xxx",
+    "approveCondition": "any"
   }
 }
 ```
 
+필드 설명:
+- `webhook.enabled`: webhook 수신 활성화 여부
+- `webhook.secret`: GitHub webhook secret (signature 검증용, 선택)
+- `webhook.smeeUrl`: smee.io 채널 URL (로컬 개발용, 선택)
+- `webhook.approveCondition`: `'any'` (기본, 최소 1개 approve) | `'all'` (모든 requested reviewer approve)
+
 ## Subagent MD 형식
 
 YAML frontmatter + 마크다운 본문 구조:
```
