# Phase 0: docs-update

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/spec.md`
- `/spec/architecture.md`
- `/spec/adr.md`

## 작업 내용

이번 task는 GitHub PR 이벤트(review comment, approve)를 webhook으로 수신하여 agent에게 자동으로 ticket을 생성하는 시스템을 구현한다.

### 1. `/spec/spec.md` 수정

#### 1.1 Ticket JSON 스키마에 `metadata` 필드 추가

기존 Ticket JSON 스키마 섹션에 `metadata` 필드를 추가하라:

```json
{
  "id": "uuid",
  "title": "버그 수정",
  // ... 기존 필드들 ...
  "metadata": {
    "source": "webhook",
    "github": {
      "repo": "owner/repo",
      "prNumber": 42,
      "prUrl": "https://github.com/owner/repo/pull/42",
      "commentIds": ["c1", "c2"],
      "eventType": "review_comment",
      "reviewers": ["reviewer1"]
    }
  },
  "version": 1
}
```

필드 설명 추가:
- `metadata`: 선택적 필드. ticket 생성 출처 및 관련 정보
- `metadata.source`: `'user'` | `'webhook'` | `'agent'`
- `metadata.github`: GitHub PR 관련 정보 (webhook으로 생성된 경우)
- `metadata.github.eventType`: `'review_comment'` | `'review_approved'` | `'conflict_resolve'`

#### 1.2 config.json에 webhook 설정 추가

config.json 확장 섹션에 webhook 설정을 추가하라:

```json
{
  "version": "1.0.0",
  "ticketServer": { ... },
  "webhook": {
    "enabled": true,
    "secret": "github-webhook-secret",
    "smeeUrl": "https://smee.io/xxx",
    "approveCondition": "any"
  }
}
```

필드 설명:
- `webhook.enabled`: webhook 수신 활성화 여부
- `webhook.secret`: GitHub webhook secret (signature 검증용, 선택)
- `webhook.smeeUrl`: smee.io 채널 URL (로컬 개발용, 선택)
- `webhook.approveCondition`: `'any'` (기본, 최소 1개 approve) | `'all'` (모든 requested reviewer approve)

#### 1.3 CLI Commands 섹션에 webhook 명령어 추가

```bash
cc-company webhook setup <smee-url>  # smeeUrl을 config에 저장, enabled=true
cc-company webhook status            # 현재 webhook 설정 표시
cc-company webhook disable           # webhook.enabled = false
```

### 2. `/spec/architecture.md` 수정

#### 2.1 레이어 구조에 Webhook Receiver 추가

기존 레이어 구조 다이어그램 아래에 추가:

```
Webhook Receiver (이벤트 수신) → PR Event Service (이벤트 처리) → Ticket Service (티켓 생성)
```

#### 2.2 Webhook Receiver 섹션 추가

Server 섹션 아래에 새 섹션 추가:

```markdown
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
```

#### 2.3 소스 디렉토리 구조 업데이트

기존 구조에 추가:

```
src/
├── ...
├── webhook-receiver/
│   ├── index.ts              # IWebhookReceiver 인터페이스
│   ├── smee-receiver.ts      # smee-client 래퍼 (로컬용)
│   └── sse-receiver.ts       # SSE 클라이언트 (원격용, stub)
├── gh-client/
│   └── index.ts              # IGhClient 인터페이스 + 구현
├── services/
│   ├── ...
│   ├── pr-event.service.ts   # PR 이벤트 → ticket 변환
│   └── merge.service.ts      # PR merge 실행
└── types/
    ├── index.ts
    └── github-events.ts      # GitHub webhook payload 타입
```

#### 2.4 데이터 흐름 추가

새 섹션 "Webhook 이벤트 처리 흐름" 추가:

```markdown
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
```

### 3. `/spec/adr.md` 수정

파일 끝에 새 ADR 2개 추가:

```markdown
---

## ADR-020: Webhook 기반 PR 이벤트 연동

**상태**: 확정 (2026-03-23)

**맥락**: agent가 작성한 PR에 review comment나 approve가 달리면 자동으로 ticket을 생성하여 agent가 대응할 수 있게 해야 한다. GitHub App vs repo-level webhook, 로컬 개발 환경에서의 webhook 수신 방법을 결정해야 한다.

**결정**: Repo-level webhook + smee.io (로컬) / 자체 SSE (원격)

**근거**:
- GitHub App은 설치 복잡도가 높고, MVP 단계에서 과잉
- Repo-level webhook은 설정이 단순하고 필요한 기능 충분
- 로컬 환경은 퍼블릭 IP가 없으므로 smee.io 프록시 사용
- 향후 원격 서버 모드에서는 자체 SSE 엔드포인트로 대체 (smee 노출 없이)
- IWebhookReceiver 인터페이스로 추상화하여 전환 비용 최소화

**구현 위치**:
- `src/webhook-receiver/` — 수신 추상화
- `src/server/routes/webhooks.ts` — HTTP 엔드포인트
- `src/services/pr-event.service.ts` — 이벤트 처리

---

## ADR-021: Ticket metadata 범용 필드

**상태**: 확정 (2026-03-23)

**맥락**: webhook으로 생성된 ticket은 PR 번호, comment ID 등 추가 정보가 필요하다. 중복 ticket 방지, merge 시 PR 정보 참조 등에 사용된다. ticket 스키마에 어떻게 추가할 것인가.

**결정**: `metadata` 필드 (범용 JSON 객체)

**근거**:
- `prNumber` 같은 단일 필드보다 확장성 있음
- 향후 Jira, Slack 등 다른 소스 연동 시 해당 키만 추가
- `metadata.source`로 생성 출처 추적 (user/webhook/agent)
- `metadata.github`로 GitHub 관련 정보 묶음

**스키마**:
```typescript
interface TicketMetadata {
  source?: 'user' | 'webhook' | 'agent'
  github?: {
    repo: string
    prNumber: number
    prUrl: string
    commentIds?: string[]
    eventType?: 'review_comment' | 'review_approved' | 'conflict_resolve'
    reviewers?: string[]
  }
}
```
```

## Acceptance Criteria

```bash
npm run build  # 컴파일 에러 없음
npm test       # 기존 테스트 모두 통과 (문서 변경은 테스트에 영향 없음)
```

추가로, 아래 문서들이 올바르게 업데이트되었는지 수동 확인:
- `/spec/spec.md`에 metadata 필드, webhook 설정, CLI 명령어가 추가됨
- `/spec/architecture.md`에 Webhook Receiver, PR Event Service, 데이터 흐름이 추가됨
- `/spec/adr.md`에 ADR-020, ADR-021이 추가됨

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/8-pr-webhook/index.json`의 phase 0 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 이 phase는 문서 업데이트만 수행한다. 코드를 작성하지 마라.
- 기존 문서의 구조와 스타일을 유지하라.
- ADR 번호가 기존 ADR과 충돌하지 않는지 확인하라 (현재 마지막 ADR-019).
