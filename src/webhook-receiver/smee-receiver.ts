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
