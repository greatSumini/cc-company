# Phase 2: webhook-receiver

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/spec.md`
- `/spec/architecture.md`
- `/spec/adr.md` (특히 ADR-020)
- `/tasks/8-pr-webhook/spec-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/src/types/index.ts` (TicketMetadata, WebhookConfig 타입 추가됨)

## 작업 내용

### 1. smee-client 의존성 추가

```bash
npm install smee-client
npm install -D @types/smee-client
```

만약 `@types/smee-client`가 없다면, 직접 타입 선언을 추가해야 한다.

### 2. `/src/webhook-receiver/index.ts` 생성

```typescript
/**
 * Webhook Receiver 추상화 인터페이스
 *
 * 로컬 환경: SmeeReceiver (smee.io 프록시 사용)
 * 원격 환경: SseReceiver (자체 SSE 엔드포인트, 향후 구현)
 */

export interface WebhookEvent {
  /** GitHub 이벤트 타입 (X-GitHub-Event 헤더) */
  type: string
  /** GitHub 이벤트 payload */
  payload: unknown
  /** 이벤트 수신 시각 */
  receivedAt: string
  /** 원본 헤더 (signature 검증용) */
  headers: Record<string, string>
}

export type WebhookEventHandler = (event: WebhookEvent) => void | Promise<void>

export interface IWebhookReceiver {
  /**
   * Receiver 시작
   * - SmeeReceiver: smee-client 연결
   * - SseReceiver: SSE 스트림 구독
   */
  start(): Promise<void>

  /**
   * Receiver 중지
   * - 연결 해제, 리소스 정리
   */
  stop(): Promise<void>

  /**
   * 이벤트 핸들러 등록
   * - 이벤트 수신 시 호출됨
   */
  onEvent(handler: WebhookEventHandler): void
}
```

### 3. `/src/webhook-receiver/smee-receiver.ts` 생성

```typescript
import SmeeClient from 'smee-client'
import type { IWebhookReceiver, WebhookEvent, WebhookEventHandler } from './index.js'

/**
 * smee.io 기반 로컬 webhook 수신기
 *
 * 동작 방식:
 * 1. smee.io에서 SSE로 이벤트 수신
 * 2. 로컬 서버(targetUrl)로 POST 포워딩
 * 3. 등록된 핸들러에게 이벤트 전달
 */
export class SmeeReceiver implements IWebhookReceiver {
  private client: SmeeClient | null = null
  private handler: WebhookEventHandler | null = null
  private events: EventSource | null = null

  constructor(
    private readonly smeeUrl: string,
    private readonly targetUrl: string
  ) {}

  async start(): Promise<void> {
    if (this.client) {
      console.warn('[SmeeReceiver] Already started')
      return
    }

    this.client = new SmeeClient({
      source: this.smeeUrl,
      target: this.targetUrl,
      logger: console,
    })

    // smee-client는 내부적으로 EventSource를 사용
    // start()는 EventSource를 반환
    this.events = this.client.start()

    console.log(`[SmeeReceiver] Started: ${this.smeeUrl} -> ${this.targetUrl}`)
  }

  async stop(): Promise<void> {
    if (this.events) {
      this.events.close()
      this.events = null
    }
    this.client = null
    console.log('[SmeeReceiver] Stopped')
  }

  onEvent(handler: WebhookEventHandler): void {
    this.handler = handler
    // 참고: smee-client는 이벤트를 직접 targetUrl로 POST한다.
    // 실제 이벤트 처리는 Express 라우트에서 수행.
    // 이 핸들러는 향후 확장용으로 유지.
  }
}
```

**핵심 설계 포인트**:
- smee-client는 smee.io → targetUrl로 POST를 포워딩한다.
- 실제 webhook 처리는 Express의 `/webhooks/github` 라우트에서 수행한다.
- `onEvent` 핸들러는 현재는 사용하지 않지만, 인터페이스 일관성과 향후 확장을 위해 유지한다.

### 4. `/src/webhook-receiver/sse-receiver.ts` 생성 (stub)

향후 원격 서버 모드를 위한 stub. 현재는 NotImplementedError를 던지도록 구현:

```typescript
import type { IWebhookReceiver, WebhookEventHandler } from './index.js'

/**
 * SSE 기반 원격 webhook 수신기 (향후 구현)
 *
 * 원격 서버 모드에서 cc-company 서버의 SSE 엔드포인트를 구독하여
 * GitHub webhook 이벤트를 수신한다.
 */
export class SseReceiver implements IWebhookReceiver {
  constructor(
    private readonly serverUrl: string,
    private readonly orgId: string
  ) {}

  async start(): Promise<void> {
    throw new Error('SseReceiver is not implemented yet. Use SmeeReceiver for local development.')
  }

  async stop(): Promise<void> {
    // no-op
  }

  onEvent(_handler: WebhookEventHandler): void {
    // no-op
  }
}
```

### 5. smee-client 타입 선언 (필요시)

`@types/smee-client`가 npm에 없다면 `/src/types/smee-client.d.ts` 생성:

```typescript
declare module 'smee-client' {
  interface SmeeClientOptions {
    source: string
    target: string
    logger?: Console
  }

  class SmeeClient {
    constructor(options: SmeeClientOptions)
    start(): EventSource
  }

  export default SmeeClient
}
```

## Acceptance Criteria

```bash
npm run build  # 컴파일 에러 없음
npm test       # 모든 테스트 통과
```

추가로 수동 확인:
- `smee-client` 패키지가 package.json에 추가됨
- `/src/webhook-receiver/index.ts`, `smee-receiver.ts`, `sse-receiver.ts` 파일 존재

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/8-pr-webhook/index.json`의 phase 2 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- SmeeReceiver는 smee-client 라이브러리를 래핑만 한다. 복잡한 로직을 추가하지 마라.
- SseReceiver는 stub으로 유지하라. 실제 구현은 원격 서버 기능 개발 시 진행한다.
- smee-client의 타입이 없을 경우에만 타입 선언 파일을 추가하라.
- 기존 테스트를 깨뜨리지 마라.
