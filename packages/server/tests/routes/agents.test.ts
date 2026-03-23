import { describe, it, expect, vi, beforeAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/index.js'
import type { Express } from 'express'
import type { TicketService, IAgentStatusStore, IStore, AgentConfig } from '@agentinc/core'

describe('GET /agents', () => {
  let app: Express

  const mockAgents: AgentConfig[] = [
    {
      name: 'developer',
      description: 'Development agent',
      subagents: [],
      skills: [],
      hooks: [],
    },
    {
      name: 'designer',
      description: 'Design agent',
      subagents: [],
      skills: [],
      hooks: [],
    },
  ]

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

  const mockAgentStore = {
    listAgents: vi.fn().mockReturnValue(mockAgents),
    getAgent: vi.fn(),
  } as unknown as IStore

  beforeAll(() => {
    app = createApp({
      ticketService: mockTicketService,
      agentStatusStore: mockAgentStatusStore,
      agentStore: mockAgentStore,
    })
  })

  it('에이전트 목록을 배열로 반환한다', async () => {
    const response = await request(app).get('/agents').expect(200)

    expect(Array.isArray(response.body)).toBe(true)
    expect(response.body).toHaveLength(2)
  })

  it('각 에이전트는 name과 description을 포함한다', async () => {
    const response = await request(app).get('/agents').expect(200)

    expect(response.body.length).toBeGreaterThan(0)
    expect(response.body[0]).toHaveProperty('name')
    expect(response.body[0]).toHaveProperty('description')
    expect(response.body[0].name).toBe('developer')
    expect(response.body[0].description).toBe('Development agent')
  })
})

describe('GET /agents without agentStore', () => {
  let app: Express

  const mockTicketService = {} as TicketService
  const mockAgentStatusStore = {
    get: vi.fn(),
    getAll: vi.fn().mockResolvedValue([]),
    updateHeartbeat: vi.fn(),
    updateState: vi.fn(),
  } as unknown as IAgentStatusStore

  beforeAll(() => {
    // agentStore 없이 app 생성
    app = createApp({
      ticketService: mockTicketService,
      agentStatusStore: mockAgentStatusStore,
    })
  })

  it('agentStore 미설정 시 501 반환', async () => {
    const response = await request(app).get('/agents').expect(501)

    expect(response.body.error).toBe('agentStore not configured')
  })
})
