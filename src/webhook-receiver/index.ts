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
