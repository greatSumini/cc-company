import { Router, Request, Response } from 'express'
import { eventBus } from '../events/event-bus.js'

export const eventsRouter = Router()

// SSE 클라이언트 관리
const clients = new Set<Response>()

eventsRouter.get('/', (req: Request, res: Response) => {
  // SSE 헤더 설정
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // nginx 프록시 대응
  res.flushHeaders()

  // 클라이언트 등록
  clients.add(res)

  // 연결 확인용 초기 이벤트
  res.write(`event: connected\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`)

  // 연결 종료 시 정리
  req.on('close', () => {
    clients.delete(res)
  })
})

// 모든 클라이언트에게 이벤트 브로드캐스트
function broadcast(event: string, data: unknown): void {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  clients.forEach((client) => {
    client.write(message)
  })
}

// 이벤트 버스 리스너 등록
eventBus.on('ticket:created', (payload) => broadcast('ticket:created', payload))
eventBus.on('ticket:updated', (payload) => broadcast('ticket:updated', payload))
eventBus.on('agent:status', (payload) => broadcast('agent:status', payload))

// 테스트용 export
export function getClientsCount(): number {
  return clients.size
}
