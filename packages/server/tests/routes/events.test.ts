import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import http from 'http'
import { createApp } from '../../src/index.js'
import { eventBus } from '../../src/events/event-bus.js'
import type { Express } from 'express'
import type { TicketService, IAgentStatusStore, Ticket } from '@agentinc/core'
import type { Server } from 'http'

describe('GET /events (SSE)', () => {
  let app: Express
  let server: Server
  let port: number

  // Mock dependencies
  const mockTicketService = {
    createTicket: vi.fn(),
    getTicket: vi.fn(),
    listTickets: vi.fn(),
    updateTicketStatus: vi.fn(),
    updateTicketPriority: vi.fn(),
    cancelTicket: vi.fn(),
    addComment: vi.fn(),
    saveLog: vi.fn(),
    getLog: vi.fn(),
  } as unknown as TicketService

  const mockAgentStatusStore = {
    get: vi.fn(),
    getAll: vi.fn().mockResolvedValue([]),
    updateHeartbeat: vi.fn(),
    updateState: vi.fn(),
  } as unknown as IAgentStatusStore

  beforeAll(async () => {
    app = createApp({
      ticketService: mockTicketService,
      agentStatusStore: mockAgentStatusStore,
    })

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address()
        port = typeof address === 'object' ? address!.port : 0
        resolve()
      })
    })
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
    })
  })

  it('SSE 연결 성공 시 올바른 헤더를 반환한다', () => {
    return new Promise<void>((resolve, reject) => {
      const req = http.request(
        {
          hostname: 'localhost',
          port,
          path: '/events',
          method: 'GET',
        },
        (res) => {
          expect(res.statusCode).toBe(200)
          expect(res.headers['content-type']).toMatch(/text\/event-stream/)
          expect(res.headers['cache-control']).toBe('no-cache')

          // 연결 종료
          res.destroy()
          resolve()
        }
      )

      req.on('error', reject)
      req.end()

      setTimeout(() => {
        req.destroy()
        reject(new Error('Timeout'))
      }, 3000)
    })
  })

  it('연결 시 connected 이벤트를 수신한다', () => {
    return new Promise<void>((resolve, reject) => {
      const req = http.request(
        {
          hostname: 'localhost',
          port,
          path: '/events',
          method: 'GET',
        },
        (res) => {
          let data = ''
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString()
            if (data.includes('event: connected')) {
              expect(data).toContain('event: connected')
              res.destroy()
              resolve()
            }
          })
          res.on('error', () => {
            // Ignore error on destroy
          })
        }
      )

      req.on('error', reject)
      req.end()

      setTimeout(() => {
        req.destroy()
        reject(new Error('Timeout waiting for connected event'))
      }, 3000)
    })
  })

  it('eventBus emit 시 클라이언트가 이벤트를 수신한다', () => {
    const testTicket: Ticket = {
      id: 'test-123',
      title: 'Test Ticket',
      prompt: 'Test prompt',
      type: 'task',
      assignee: 'test-agent',
      priority: 'normal',
      status: 'ready',
      createdBy: 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      comments: [],
    }

    return new Promise<void>((resolve, reject) => {
      let receivedConnected = false

      const req = http.request(
        {
          hostname: 'localhost',
          port,
          path: '/events',
          method: 'GET',
        },
        (res) => {
          let data = ''
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString()

            // connected 이벤트 수신 후 ticket 이벤트 발행
            if (data.includes('event: connected') && !receivedConnected) {
              receivedConnected = true
              setTimeout(() => {
                eventBus.emitEvent({ type: 'ticket:created', payload: testTicket })
              }, 50)
            }

            if (data.includes('ticket:created')) {
              expect(data).toContain('event: ticket:created')
              expect(data).toContain('test-123')
              res.destroy()
              resolve()
            }
          })
          res.on('error', () => {
            // Ignore error on destroy
          })
        }
      )

      req.on('error', reject)
      req.end()

      setTimeout(() => {
        req.destroy()
        reject(new Error('Timeout waiting for ticket:created event'))
      }, 3000)
    })
  })
})
