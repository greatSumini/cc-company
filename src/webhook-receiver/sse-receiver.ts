import type { IWebhookReceiver, WebhookEventHandler } from './index.js'

/**
 * SSE 기반 원격 webhook 수신기 (향후 구현)
 *
 * 원격 서버 모드에서 agentinc 서버의 SSE 엔드포인트를 구독하여
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
